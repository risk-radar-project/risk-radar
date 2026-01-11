/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-len */
import { AuditLogService } from '../../../src/services/audit-log-service';
import { config } from '../../../src/config/config';
import {
    createValidAuditLog,
    createQueryResult
} from '../../setup/test-helpers';

// Mock dependencies
jest.mock('../../../src/database/database', () => ({
    database: {
        query: jest.fn(),
    },
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid-123'),
}));

describe('AuditLogService', () => {
    let auditLogService: AuditLogService;
    let mockDatabase: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Get mocked database
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        mockDatabase = require('../../../src/database/database').database;

        // Create service instance
        auditLogService = new AuditLogService();
    });

    describe('createLog', () => {
        it('should create audit log with valid data', async () => {
            // Arrange
            const logData = createValidAuditLog();
            const dbResult = createQueryResult([{
                id: 'test-uuid-123',
                timestamp: logData.timestamp,
                service: logData.service,
                action: logData.action,
                actor: logData.actor,
                target: logData.target,
                status: logData.status,
                operation_id: logData.operation_id,
                log_type: logData.log_type,
                metadata: logData.metadata,
                is_anonymized: false,
            }]);

            mockDatabase.query.mockResolvedValue(dbResult);

            // Act
            const result = await auditLogService.createLog(logData);

            // Assert
            expect(result.created).toBe(true);
            expect(result.log.id).toBe('test-uuid-123');
            expect(result.log.service).toBe(logData.service);
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO audit_logs'),
                expect.arrayContaining([
                    'test-uuid-123',
                    logData.timestamp,
                    logData.service,
                    logData.action,
                ])
            );
        });

        it('should handle idempotency with operation_id', async () => {
            // Arrange
            const logData = createValidAuditLog({ operation_id: 'existing-op' });
            const existingLog = createValidAuditLog({ id: 'existing-id' });

            // First call creates the log (INSERT returns row)
            const createResult = createQueryResult([existingLog]);
            // Second call: INSERT conflicts (no rows), then SELECT by operation_id returns existing
            const conflictInsert = { rows: [], rowCount: 0 } as any;
            const selectByOp = createQueryResult([existingLog]);

            mockDatabase.query
                .mockResolvedValueOnce(createResult)    // First INSERT
                .mockResolvedValueOnce(conflictInsert)  // Second INSERT (conflict)
                .mockResolvedValueOnce(selectByOp);     // SELECT by operation_id

            // Act - First call
            const firstResult = await auditLogService.createLog(logData);

            // Act - Second call with same operation_id (should return existing)
            const secondResult = await auditLogService.createLog(logData);

            // Assert
            expect(firstResult.created).toBe(true);
            expect(secondResult.created).toBe(false); // Idempotency
            expect(secondResult.log.id).toBe(existingLog.id);
        });

        it('should auto-generate timestamp if not provided', async () => {
            // Arrange
            const logData = createValidAuditLog();
            delete (logData as any).timestamp; // Remove timestamp to test auto-generation
            delete (logData as any).operation_id; // Remove operation_id to avoid idempotency checks

            const resultLog = { ...logData, id: 'test-uuid-123', timestamp: new Date().toISOString() };
            const dbResult = createQueryResult([resultLog]);

            // Mock should resolve for INSERT
            mockDatabase.query.mockResolvedValue(dbResult);

            // Act
            const result = await auditLogService.createLog(logData);

            // Assert
            expect(result.log.timestamp).toBeDefined();
            expect(typeof result.log.timestamp).toBe('string');
            // Check that the INSERT query was called
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO audit_logs'),
                expect.arrayContaining([
                    'test-uuid-123',
                    expect.any(String), // Auto-generated timestamp
                    logData.service,
                    logData.action,
                ])
            );
        });

        it('should throw error when database fails', async () => {
            // Arrange
            const logData = createValidAuditLog();
            const dbError = new Error('Database connection failed');

            mockDatabase.query.mockRejectedValue(dbError);

            // Act & Assert
            await expect(auditLogService.createLog(logData)).rejects.toThrow(dbError);
        });
    });

    describe('getLogs', () => {
        it('should get logs with default pagination', async () => {
            // Arrange
            const logs = [createValidAuditLog(), createValidAuditLog({ id: 'log2' })];
            const countResult = createQueryResult([{ count: '2' }]);
            const logsResult = createQueryResult(logs);

            mockDatabase.query
                .mockResolvedValueOnce(countResult)  // Count query
                .mockResolvedValueOnce(logsResult);  // Logs query

            // Act
            const result = await auditLogService.getLogs();

            // Assert
            expect(result.data).toHaveLength(2);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.pageSize).toBe(config.defaultPageSize);
            expect(result.pagination.total).toBe(2);
            expect(result.pagination.totalPages).toBe(1);
        });

        it('should apply filters correctly', async () => {
            // Arrange
            const filters = {
                service: 'test-service',
                action: 'test-action',
                actor_id: 'user123',
                status: 'success' as const,
            };

            const countResult = createQueryResult([{ count: '1' }]);
            const logsResult = createQueryResult([createValidAuditLog()]);

            mockDatabase.query
                .mockResolvedValueOnce(countResult)
                .mockResolvedValueOnce(logsResult);

            // Act
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const result = await auditLogService.getLogs(filters);

            // Assert
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE service ILIKE $1 AND action ILIKE $2'),
                expect.arrayContaining(['%test-service%', '%test-action%', '%user123%', 'success'])
            );
        });

        it('should handle pagination correctly', async () => {
            // Arrange
            const pagination = { page: 2, limit: 10 };
            const countResult = createQueryResult([{ count: '25' }]);
            const logsResult = createQueryResult([createValidAuditLog()]);

            mockDatabase.query
                .mockResolvedValueOnce(countResult)
                .mockResolvedValueOnce(logsResult);

            // Act
            const result = await auditLogService.getLogs({}, pagination);

            // Assert
            expect(result.pagination.page).toBe(2);
            expect(result.pagination.pageSize).toBe(10);
            expect(result.pagination.total).toBe(25);
            expect(result.pagination.totalPages).toBe(3);

            // Check OFFSET calculation (page 2, limit 10 = offset 10)
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.stringContaining('LIMIT $1 OFFSET $2'),
                expect.arrayContaining([10, 10]) // limit, offset
            );
        });

        it('should enforce maximum page size', async () => {
            // Arrange
            const pagination = { limit: 5000 }; // Exceeds max
            const countResult = createQueryResult([{ count: '1' }]);
            const logsResult = createQueryResult([createValidAuditLog()]);

            mockDatabase.query
                .mockResolvedValueOnce(countResult)
                .mockResolvedValueOnce(logsResult);

            // Act
            const result = await auditLogService.getLogs({}, pagination);

            // Assert
            expect(result.pagination.pageSize).toBe(config.maxPageSize);
        });
    });

    describe('getLogById', () => {
        it('should return log when found', async () => {
            // Arrange
            const log = createValidAuditLog();
            const dbResult = createQueryResult([log]);

            mockDatabase.query.mockResolvedValue(dbResult);

            // Act
            const result = await auditLogService.getLogById(log.id!);

            // Assert
            expect(result).toEqual(log);
            expect(mockDatabase.query).toHaveBeenCalledWith(
                'SELECT * FROM audit_logs WHERE id = $1',
                [log.id]
            );
        });

        it('should return null when log not found', async () => {
            // Arrange
            const dbResult = createQueryResult([]); // Empty result

            mockDatabase.query.mockResolvedValue(dbResult);

            // Act
            const result = await auditLogService.getLogById('non-existent-id');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getAnonymizationCount', () => {
        it('should return count of logs to anonymize', async () => {
            // Arrange
            const actorId = 'user123';
            const dbResult = createQueryResult([{ count: '5' }]);

            mockDatabase.query.mockResolvedValue(dbResult);

            // Act
            const result = await auditLogService.getAnonymizationCount(actorId);

            // Assert
            expect(result).toBe(5);
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.stringContaining('COUNT(*) as count'),
                [actorId]
            );
        });
    });

    describe('anonymizeLogs', () => {
        it('should anonymize logs for actor', async () => {
            // Arrange
            const actorId = 'user123';
            const dbResult = { rows: [], rowCount: 3 };

            mockDatabase.query.mockResolvedValue(dbResult);

            // Act
            const result = await auditLogService.anonymizeLogs(actorId);

            // Assert
            expect(result).toBe(3);
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE audit_logs'),
                [actorId]
            );
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.stringContaining('is_anonymized = true'),
                [actorId]
            );
        });

        it('should return 0 when no logs to anonymize', async () => {
            // Arrange
            const actorId = 'user123';
            const dbResult = { rows: [], rowCount: 0 };

            mockDatabase.query.mockResolvedValue(dbResult);

            // Act
            const result = await auditLogService.anonymizeLogs(actorId);

            // Assert
            expect(result).toBe(0);
        });
    });

    describe('cleanupOldLogs', () => {
        it('should cleanup old logs using application-level DELETE based on retention days', async () => {
            // Arrange
            const dbResult = { rows: [], rowCount: 42 };

            mockDatabase.query.mockResolvedValue(dbResult);

            // Act
            const result = await auditLogService.cleanupOldLogs();

            // Assert
            expect(result).toBe(42);
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL'),
            );
        });
    });
});
