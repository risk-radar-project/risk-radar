/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Unit tests for Audit Log Controllers
 * Tests HTTP endpoints with mocked service layer
 */

import * as auditController from '../../../src/controllers/audit-controller';
import {
    createMockRequest,
    createMockResponse,
    createMockNext,
    createValidCreateLogRequest,
    createValidAuditLog,
} from '../../setup/test-helpers';

// Mock dependencies
const mockBroadcastNewLog = jest.fn();

jest.mock('../../../src/services/audit-log-service', () => ({
    auditLogService: {
        createLog: jest.fn(),
        getLogs: jest.fn(),
        getLogById: jest.fn(),
        getAnonymizationCount: jest.fn(),
        anonymizeLogs: jest.fn(),
    },
}));

jest.mock('../../../src/clients/authz-client', () => ({
    authzClient: {
        hasPermission: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../../../src/websocket/websocket-handler', () => ({
    getWebSocketHandler: jest.fn(() => ({
        broadcastNewLog: mockBroadcastNewLog,
    })),
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
    },
}));

describe('Audit Controller', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;
    let mockAuditLogService: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = createMockRequest();
        mockRes = createMockResponse();
        mockNext = createMockNext();

        // Add missing properties for anonymizeLogs tests
        mockReq.query = {};
        mockReq.ip = '127.0.0.1';
        mockReq.headers = { 'user-agent': 'test-agent', 'x-user-id': 'user-123' };
        mockRes.end = jest.fn().mockReturnThis();

        // Get mocked services
        mockAuditLogService = require('../../../src/services/audit-log-service').auditLogService;
    });

    describe('createLog', () => {
        it('should create log and return 201', async () => {
            // Arrange
            const requestData = createValidCreateLogRequest();
            const createdLog = createValidAuditLog({ id: 'new-log-id' });

            mockReq.body = requestData;
            mockAuditLogService.createLog.mockResolvedValue({
                created: true,
                log: createdLog,
            });

            // Act
            await auditController.createLog(mockReq, mockRes, mockNext);

            // Assert
            expect(mockAuditLogService.createLog).toHaveBeenCalledWith(requestData);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(createdLog); // Direct data, not wrapped
            expect(mockBroadcastNewLog).toHaveBeenCalledWith(createdLog);
        });

        it('should return existing log with 204 for idempotency', async () => {
            // Arrange
            const requestData = createValidCreateLogRequest();
            const existingLog = createValidAuditLog({ id: 'existing-log-id' });

            mockReq.body = requestData;
            mockAuditLogService.createLog.mockResolvedValue({
                created: false, // Idempotent call
                log: existingLog,
            });

            // Act
            await auditController.createLog(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(204); // No Content for idempotency
            expect(mockRes.end).toHaveBeenCalled(); // No JSON response, just end
            // Should not broadcast for existing logs
            expect(mockBroadcastNewLog).not.toHaveBeenCalled();
        });

        it('should handle service errors gracefully', async () => {
            // Arrange
            const requestData = createValidCreateLogRequest();
            const serviceError = new Error('Database connection failed');

            mockReq.body = requestData;
            mockAuditLogService.createLog.mockRejectedValue(serviceError);

            // Act
            await auditController.createLog(mockReq, mockRes, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalledWith(serviceError);
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });
    });

    describe('getLogs', () => {
        it('should get logs with default pagination', async () => {
            // Arrange
            const logs = [createValidAuditLog(), createValidAuditLog({ id: 'log2' })];
            const paginatedResponse = {
                data: logs,
                pagination: {
                    page: 1,
                    pageSize: 50, // Default from controller
                    total: 2,
                    totalPages: 1,
                },
            };

            mockAuditLogService.getLogs.mockResolvedValue(paginatedResponse);

            // Act
            await auditController.getLogs(mockReq, mockRes, mockNext);

            // Assert
            expect(mockAuditLogService.getLogs).toHaveBeenCalledWith(
                {
                    service: undefined,
                    action: undefined,
                    actor_id: undefined,
                    target_id: undefined,
                    status: undefined,
                    log_type: undefined,
                    start_date: undefined,
                    end_date: undefined,
                },
                { page: 1, limit: 50 }
            );
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                data: logs,
                pagination: {
                    page: 1,
                    pageSize: 50, // writePaginated uses pageSize, not limit
                    total: 2,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false,
                },
            });
        });

        it('should apply filters and pagination from query', async () => {
            // Arrange
            mockReq.query = {
                service: 'user-service',
                status: 'success',
                page: '2',
                limit: '10',
            };

            const paginatedResponse = {
                data: [createValidAuditLog()],
                pagination: {
                    page: 2,
                    pageSize: 10,
                    total: 15,
                    totalPages: 2,
                },
            };

            mockAuditLogService.getLogs.mockResolvedValue(paginatedResponse);

            // Act
            await auditController.getLogs(mockReq, mockRes, mockNext);

            // Assert
            expect(mockAuditLogService.getLogs).toHaveBeenCalledWith(
                {
                    service: 'user-service',
                    action: undefined,
                    actor_id: undefined,
                    target_id: undefined,
                    status: 'success',
                    log_type: undefined,
                    start_date: undefined,
                    end_date: undefined,
                },
                { page: 2, limit: 10 }
            );
        });

        it('should handle service errors gracefully', async () => {
            // Arrange
            const serviceError = new Error('Database query failed');
            mockAuditLogService.getLogs.mockRejectedValue(serviceError);

            // Act
            await auditController.getLogs(mockReq, mockRes, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalledWith(serviceError);
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });
    });

    describe('getLogById', () => {
        it('should return log when found', async () => {
            // Arrange
            const log = createValidAuditLog();
            mockReq.params = { id: log.id };
            mockAuditLogService.getLogById.mockResolvedValue(log);

            // Act
            await auditController.getLogById(mockReq, mockRes, mockNext);

            // Assert
            expect(mockAuditLogService.getLogById).toHaveBeenCalledWith(log.id);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(log); // Direct data, not wrapped
        });

        it('should return 404 when log not found', async () => {
            // Arrange
            mockReq.params = { id: 'non-existent-id' };
            mockAuditLogService.getLogById.mockResolvedValue(null);

            // Act
            await auditController.getLogById(mockReq, mockRes, mockNext);

            // Assert
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Audit log not found',
                message: 'Audit log not found',
            });
        });

        it('should handle service errors gracefully', async () => {
            // Arrange
            const serviceError = new Error('Database query failed');
            mockReq.params = { id: 'test-id' };
            mockAuditLogService.getLogById.mockRejectedValue(serviceError);

            // Act
            await auditController.getLogById(mockReq, mockRes, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalledWith(serviceError);
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });
    });

    describe('anonymizeLogs', () => {
        it('should anonymize logs when dry_run is false', async () => {
            // Arrange
            mockReq.body = { actor_id: 'user123' };
            mockReq.query = {}; // No dry_run parameter, so should do real anonymization
            mockAuditLogService.anonymizeLogs.mockResolvedValue(3);

            // Act
            await auditController.anonymizeLogs(mockReq, mockRes, mockNext);

            // Assert
            expect(mockAuditLogService.anonymizeLogs).toHaveBeenCalledWith('user123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Logs anonymized successfully',
                affected_rows: 3,
            });
        });

        it('should return count without anonymizing when dry_run is true', async () => {
            // Arrange
            mockReq.body = { actor_id: 'user123' };
            mockReq.query = { dry_run: 'true' }; // Dry run mode
            mockAuditLogService.getAnonymizationCount.mockResolvedValue(3);

            // Act
            await auditController.anonymizeLogs(mockReq, mockRes, mockNext);

            // Assert
            expect(mockAuditLogService.getAnonymizationCount).toHaveBeenCalledWith('user123');
            expect(mockAuditLogService.anonymizeLogs).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Dry run completed',
                affected_rows: 3,
                actor_id: 'user123',
                warning: 'This is a preview. No data was modified.',
            });
        });

        it('should handle service errors gracefully', async () => {
            // Arrange
            const serviceError = new Error('Database update failed');
            mockReq.body = { actor_id: 'user123' };
            mockReq.query = { dry_run: 'false' };
            mockAuditLogService.anonymizeLogs.mockRejectedValue(serviceError);

            // Act
            await auditController.anonymizeLogs(mockReq, mockRes, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalledWith(serviceError);
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });
    });
});
