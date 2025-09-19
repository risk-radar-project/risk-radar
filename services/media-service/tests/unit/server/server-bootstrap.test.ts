process.env.HOSTNAME = 'authz';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

// Mock app & dependencies
jest.mock('../../../src/app.js', () => ({ __esModule: true, default: (req: any, res: any) => { } }));
const listenMock = jest.fn((port: number, cb: Function) => cb());
jest.mock('http', () => ({ createServer: () => ({ listen: listenMock, close: (cb: any) => cb() }) }));

const runMigrations = jest.fn(async () => { });
jest.mock('../../../src/db/migrate.js', () => ({ runMigrations: () => runMigrations() }));
const gcStart = jest.fn(); const gcStop = jest.fn();
jest.mock('../../../src/domain/gc.js', () => ({ gc: { start: () => gcStart(), stop: () => gcStop() } }));
const dbClose = jest.fn(async () => { });
jest.mock('../../../src/db/pool.js', () => ({ db: { close: () => dbClose() } }));
jest.mock('../../../src/logger/logger.js', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

// Import server (side effects execute)
import '../../../src/server.js';

describe('server bootstrap', () => {
    it('starts server and runs migrations & GC', async () => {
        expect(runMigrations).toHaveBeenCalled();
        expect(listenMock).toHaveBeenCalled();
        expect(gcStart).toHaveBeenCalled();
    });
});
