process.env.HOSTNAME = 'authz';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';
import { requestLogger } from '../../../src/middleware/request-logger.js';

jest.mock('../../../src/logger/logger.js', () => ({ logger: { info: jest.fn() } }));
jest.mock('../../../src/config/config.js', () => ({ config: { nodeEnv: 'prod' } }));

function invoke(status: number, method: string) {
    const mw = requestLogger();
    const req: any = { method, originalUrl: '/u', ip: '127.0.0.1' };
    const res: any = { statusCode: status, on: (_: string, cb: any) => cb() };
    return mw(req, res, () => { });
}

describe('request-logger colors', () => {
    it('covers various status/method color branches', async () => {
        await invoke(200, 'GET');
        await invoke(301, 'POST');
        await invoke(404, 'DELETE');
        await invoke(500, 'PATCH');
    });
});
