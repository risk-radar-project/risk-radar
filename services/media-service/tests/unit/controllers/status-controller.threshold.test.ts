process.env.HOSTNAME = 'authz.local';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';

import { statusController } from '../../../src/controllers/status-controller';

// Mock disk usage to trigger warning (not critical) branch
jest.mock('../../../src/storage/fs-storage', () => ({
    getDiskUsage: jest.fn(async () => ({ root: '/data', totalBytes: 1000, usedBytes: 820 }))
}));
// Mock config: warn=80, critical=90
jest.mock('../../../src/config/config', () => ({
    config: {
        storageThresholds: { warnPercent: 80, criticalPercent: 90 },
        mediaRoot: '/data'
    }
}));
jest.mock('../../../src/db/pool', () => ({ db: { health: jest.fn(async () => true) } }));
jest.mock('../../../src/domain/circuit-breaker', () => ({ breakersStatus: () => ([] as any[]) }));
jest.mock('../../../src/logger/logger', () => ({ logger: { debug: jest.fn() } }));
const auditCalls: any[] = [];
jest.mock('../../../src/audit/audit-emitter', () => ({ emitAudit: (e: any) => { auditCalls.push(e); return Promise.resolve(); } }));
jest.mock('../../../src/audit/events', () => ({ auditEvents: { storageThreshold: (level: string) => ({ action: 'storage_' + level }) } }));

function mockRes() {
    const res: any = { statusCode: 0, body: undefined, headers: {}, status(code: number) { this.statusCode = code; return this; }, json(p: any) { this.body = p; return this; }, setHeader(k: string, v: any) { this.headers[k] = v; } };
    return res;
}

describe('status-controller thresholds', () => {
    it('emits warn threshold (not critical)', async () => {
        const res = mockRes();
        await statusController.getStatus({} as any, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.storage_warn).toBe(true);
        expect(res.body.storage_critical).toBe(false);
    });
});
