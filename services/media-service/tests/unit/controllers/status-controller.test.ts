process.env.HOSTNAME = 'authz';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';

import { statusController } from '../../../src/controllers/status-controller.js';

// Mocks
jest.mock('../../../src/storage/fs-storage.js', () => ({
    getDiskUsage: jest.fn(async () => ({ root: '/x', totalBytes: 1000, usedBytes: 900 })),
}));
// Override config thresholds to ensure critical path triggered
jest.mock('../../../src/config/config.js', () => ({ config: { storageThresholds: { warnPercent: 50, criticalPercent: 80 }, mediaRoot: '/x' } }));
jest.mock('../../../src/db/pool.js', () => ({ db: { health: jest.fn(async () => true) } }));
jest.mock('../../../src/domain/circuit-breaker.js', () => ({ breakersStatus: () => ([{ name: 'audit', state: 'open' }, { name: 'authz', state: 'half_open' }]) }));
jest.mock('../../../src/logger/logger.js', () => ({ logger: { debug: jest.fn() } }));
jest.mock('../../../src/audit/audit-emitter.js', () => ({ emitAudit: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../src/audit/events.js', () => ({ auditEvents: { storageThreshold: (lvl: string) => ({ service: 'media', action: 'storage_' + lvl }) } }));

function mockRes() {
    const res: any = { statusCode: 0, body: undefined, headers: {}, status(code: number) { this.statusCode = code; return this; }, json(p: any) { this.body = p; return this; }, setHeader(k: string, v: any) { this.headers[k] = v; } };
    return res;
}

describe('status-controller', () => {
    it('returns status with mapped dependency states and triggers critical audit', async () => {
        const res = mockRes();
        await statusController.getStatus({} as any, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.storage_critical).toBe(true);
        expect(res.body.dependencies.audit).toBe('unavailable');
        expect(res.body.dependencies.authz).toBe('probing');
    });
});
