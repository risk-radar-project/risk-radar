/* eslint-disable @typescript-eslint/no-explicit-any */
import { errorHandler, notFoundHandler, AppError } from '../../../src/middleware/error-handler';

const json = jest.fn();
const status = jest.fn(() => ({ json }));
const res: any = { status };

const req: any = { method: 'GET', path: '/x' };

jest.mock('../../../src/utils/logger', () => ({
    logger: { error: jest.fn() },
}));

describe('error-handler', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sends provided statusCode and message', () => {
        const err: AppError = Object.assign(new Error('bad request'), { statusCode: 400 });

        errorHandler(err, req, res);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'bad request', message: 'bad request' })
        );
    });

    it('defaults to 500 when statusCode not provided', () => {
        const err: AppError = new Error('oops');

        errorHandler(err, req, res);

        expect(status).toHaveBeenCalledWith(500);
    });

    it('returns 404 for notFoundHandler', () => {

        notFoundHandler(req, res);
        expect(status).toHaveBeenCalledWith(404);
    });
});
