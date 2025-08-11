/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { healthCheck } from '../../../src/controllers/health-controller';

// Mocks
const dbHealthCheck = jest.fn();
jest.mock('../../../src/database/database', () => ({
    database: { healthCheck: (...args: any[]) => dbHealthCheck(...args) },
}));

const getWsHandler = jest.fn();
const mockWs = { getConnectedClientsCount: jest.fn(() => 2) };
jest.mock('../../../src/websocket/websocket-handler', () => ({
    getWebSocketHandler: (...args: any[]) => getWsHandler(...args),
}));

const json = jest.fn();
const status = jest.fn(() => ({ json }));
const res: any = { status };

describe('healthCheck', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 200 with healthy DB and reports WS when present', async () => {
        dbHealthCheck.mockResolvedValueOnce(true);
        getWsHandler.mockReturnValueOnce(mockWs);

        await healthCheck({} as any, res);

        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'OK',
                database_connection: 'healthy',
                websocket_enabled: true,
                websocket_connections: 2,
            })
        );
    });

    it('returns 503 when DB unhealthy and WS absent', async () => {
        dbHealthCheck.mockResolvedValueOnce(false);
        getWsHandler.mockReturnValueOnce(null);

        await healthCheck({} as any, res);

        expect(status).toHaveBeenCalledWith(503);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                database_connection: 'unhealthy',
                websocket_enabled: false,
                websocket_connections: 0,
            })
        );
    });

    it('returns 503 with error payload when health check throws', async () => {
        dbHealthCheck.mockRejectedValueOnce(new Error('boom'));

        await healthCheck({} as any, res);

        expect(status).toHaveBeenCalledWith(503);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'error', error: 'Health check failed' })
        );
    });
});
