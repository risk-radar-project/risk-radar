/* eslint-disable @typescript-eslint/no-explicit-any */
import { processKafkaMessage } from '../../../src/messaging/kafka-consumer';
import { auditLogService } from '../../../src/services/audit-log-service';
import { getWebSocketHandler } from '../../../src/websocket/websocket-handler';
import { logger } from '../../../src/utils/logger';
import {
    createValidAuditLog,
    createValidCreateLogRequest,
} from '../../setup/test-helpers';

jest.mock('../../../src/services/audit-log-service', () => ({
    auditLogService: {
        createLog: jest.fn(),
    },
}));

jest.mock('../../../src/websocket/websocket-handler', () => ({
    getWebSocketHandler: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('processKafkaMessage', () => {
    const baseContext = {
        topic: 'audit_logs',
        partition: 0,
        offset: '1',
        key: null as string | null,
    };

    const mockCreateLog = auditLogService.createLog as jest.Mock;
    const mockGetWebSocketHandler = getWebSocketHandler as jest.Mock;
    const mockLogger = logger as jest.Mocked<typeof logger>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should persist a valid message and broadcast when created', async () => {
        const payload = createValidCreateLogRequest({ operation_id: 'op-1' });
        delete (payload as any).timestamp;

        const storedLog = createValidAuditLog({ id: 'log-1' });
        mockCreateLog.mockResolvedValue({ created: true, log: storedLog });

        const mockWs = { broadcastNewLog: jest.fn() };
        mockGetWebSocketHandler.mockReturnValue(mockWs);

        await processKafkaMessage(Buffer.from(JSON.stringify(payload)), baseContext);

        expect(mockCreateLog).toHaveBeenCalledWith(expect.objectContaining({
            service: payload.service,
            timestamp: expect.any(String),
            operation_id: payload.operation_id,
        }));
        expect(mockWs.broadcastNewLog).toHaveBeenCalledWith(storedLog);
    });

    it('should skip broadcasting when log is not newly created', async () => {
        const payload = createValidCreateLogRequest({ operation_id: 'op-dup' });
        mockCreateLog.mockResolvedValue({
            created: false,
            log: createValidAuditLog({ id: 'existing-log' }),
        });

        const mockWs = { broadcastNewLog: jest.fn() };
        mockGetWebSocketHandler.mockReturnValue(mockWs);

        await processKafkaMessage(Buffer.from(JSON.stringify(payload)), baseContext);

        expect(mockCreateLog).toHaveBeenCalled();
        expect(mockWs.broadcastNewLog).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Kafka audit log skipped due to idempotency'),
            expect.any(Object)
        );
    });

    it('should log and ignore invalid JSON payloads', async () => {
        await processKafkaMessage('not-json', baseContext);

        expect(mockCreateLog).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse Kafka message as JSON'),
            expect.objectContaining({
                topic: baseContext.topic,
                partition: baseContext.partition,
                offset: baseContext.offset,
            })
        );
    });

    it('should log and ignore payloads failing validation', async () => {
        const invalidPayload = { ...createValidCreateLogRequest(), service: '' };

        await processKafkaMessage(Buffer.from(JSON.stringify(invalidPayload)), baseContext);

        expect(mockCreateLog).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Invalid Kafka audit log payload received'),
            expect.objectContaining({
                topic: baseContext.topic,
                partition: baseContext.partition,
                offset: baseContext.offset,
            })
        );
    });

    it('should log an error when persistence fails', async () => {
        const payload = createValidCreateLogRequest();
        const error = new Error('db down');
        mockCreateLog.mockRejectedValue(error);

        await processKafkaMessage(Buffer.from(JSON.stringify(payload)), baseContext);

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Failed to persist Kafka audit log'),
            expect.objectContaining({
                topic: baseContext.topic,
                partition: baseContext.partition,
                offset: baseContext.offset,
                error: error.message,
            })
        );
    });
});
