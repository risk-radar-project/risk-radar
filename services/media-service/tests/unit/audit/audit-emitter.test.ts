process.env.HOSTNAME = 'authz';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';

const execMock = jest.fn(async (fn: any) => { return fn(); });
const breakerMock = { exec: (fn: any) => execMock(fn) };

jest.mock('../../../src/domain/circuit-breaker.js', () => ({
    CircuitBreaker: class { constructor(_: any) { } exec = (fn: any) => fn(); },
    registerBreaker: jest.fn(),
    getBreaker: jest.fn(() => breakerMock),
}));
jest.mock('axios', () => ({ post: jest.fn().mockResolvedValue({ status: 201 }) }));
jest.mock('../../../src/logger/logger.js', () => ({ logger: { warn: jest.fn(), debug: jest.fn() } }));

import { emitAudit } from '../../../src/audit/audit-emitter.js';
import { auditEvents } from '../../../src/audit/events.js';

describe('audit-emitter', () => {
    it('emits audit event successfully', async () => {
        const ev = auditEvents.mediaDeleted('u1', 'm1');
        await expect(emitAudit(ev)).resolves.toBeUndefined();
        expect(execMock).toHaveBeenCalled();
    });

    it('logs warning on failure after retries', async () => {
        const axios = require('axios');
        (axios.post as any).mockRejectedValueOnce(new Error('net'));
        (axios.post as any).mockRejectedValueOnce(new Error('net'));
        (axios.post as any).mockRejectedValueOnce(new Error('net'));
        const { logger } = require('../../../src/logger/logger.js');
        const ev = auditEvents.mediaDeleted('u2', 'm2');
        await emitAudit(ev); // swallow
        expect(logger.warn).toHaveBeenCalled();
    });
});