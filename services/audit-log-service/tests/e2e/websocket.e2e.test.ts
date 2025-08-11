/* eslint-disable @typescript-eslint/no-explicit-any */
import { io, Socket } from 'socket.io-client';
import request from 'supertest';

// Mock noisy or external modules
jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('../../src/database/migrate', () => ({
    runMigrations: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/retention-scheduler', () => ({
    retentionScheduler: {
        start: jest.fn(),
        stop: jest.fn(),
    },
}));

// Lightweight DB mock to satisfy health check and service calls
jest.mock('../../src/database/database', () => ({
    database: {
        healthCheck: jest.fn().mockResolvedValue(true),
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        close: jest.fn().mockResolvedValue(undefined),
    },
}));

const fakeLog = {
    id: '11111111-1111-4111-8111-111111111111',
    timestamp: new Date().toISOString(),
    service: 'user-service',
    action: 'login',
    actor: { id: 'user-123', type: 'user' },
    target: { id: 'dashboard', type: 'page' },
    status: 'success',
    operation_id: 'op-test-123',
    log_type: 'ACTION',
    metadata: { test: true },
    is_anonymized: false,
};

jest.mock('../../src/services/audit-log-service', () => ({
    auditLogService: {
        createLog: jest.fn().mockResolvedValue({ log: fakeLog, created: true }),
        getLogs: jest.fn().mockResolvedValue({ data: [fakeLog], pagination: { total: 1 } }),
        getLogById: jest.fn().mockResolvedValue(fakeLog),
        getAnonymizationCount: jest.fn().mockResolvedValue(0),
        anonymizeLogs: jest.fn().mockResolvedValue({ affected_rows: 0 }),
    },
}));

// Test
describe('WebSocket + HTTP integration (connect -> /status -> POST /logs -> WS event)', () => {
    let server: any;
    let socket: Socket | null = null;
    const baseUrl = 'http://localhost:5055';

    beforeAll(async () => {
        // Ensure WebSocket is enabled and pick a stable port for the test
        process.env.NODE_ENV = 'test';
        process.env.PORT = '5055';
        process.env.WEBSOCKET_ENABLED = 'true';
        process.env.LOG_LEVEL = 'error';
        // eslint-disable-next-line max-len
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test_audit';

        const { default: AuditLogServer } = await import('../../src/server');
        const srv = new AuditLogServer();
        await srv.start();
        server = srv; // keep reference for shutdown

        // Connect socket client
        socket = io(baseUrl, {
            transports: ['websocket'],
            timeout: 5000,
            reconnection: false,
            forceNew: true
        });

        await new Promise<void>((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
            socket!.on('connect', () => {
                clearTimeout(to);
                resolve();
            });
            socket!.on('connect_error', (err) => {
                clearTimeout(to);
                reject(err);
            });
        });
    });

    afterAll(async () => {
        if (socket) {
            await new Promise<void>((resolve) => {
                socket!.once('disconnect', () => resolve());
                socket!.disconnect();
            });
            socket.removeAllListeners();
            socket = null;
        }
        if (server) {
            await server.stop();
            server = null;
        }
    });

    it('reports websocket connection in /status and emits new_log after POST /logs', async () => {
        // 1) /status should reflect at least 1 ws connection
        const statusRes = await request(baseUrl).get('/status').expect(200);
        expect(statusRes.body.websocket_enabled).toBe(true);
        expect(statusRes.body.websocket_connections).toBeGreaterThanOrEqual(1);

        // 2) Prepare to capture WS event
        const wsEvent = new Promise<any>((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('Did not receive new_log event')), 5000);
            socket!.once('new_log', (log: any) => {
                clearTimeout(to);
                resolve(log);
            });
        });

        // 3) Trigger POST /logs
        const body = {
            service: 'user-service',
            action: 'login',
            actor: { id: 'user-123', type: 'user' },
            target: { id: 'dashboard', type: 'page' },
            status: 'success',
            log_type: 'ACTION',
            metadata: { from_test: true },
            operation_id: 'op-test-123',
        };

        const createRes = await request(baseUrl).post('/logs').send(body).expect(201);
        expect(createRes.body).toHaveProperty('id');
        expect(createRes.body.service).toBe('user-service');

        // 4) Verify WS event payload
        const eventLog = await wsEvent;
        expect(eventLog).toBeTruthy();
        expect(eventLog.service).toBe('user-service');
        expect(eventLog.action).toBe('login');
        expect(eventLog.operation_id).toBe('op-test-123');
    });
});
