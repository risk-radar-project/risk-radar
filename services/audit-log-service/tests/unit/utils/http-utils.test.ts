/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeJSON, writeError, writePaginated } from '../../../src/utils/http-utils';

// Silence logger output in these tests
jest.mock('../../../src/utils/logger', () => ({
    logger: { error: jest.fn() },
}));

const json = jest.fn();
const status = jest.fn(() => ({ json }));
const res: any = { status };

describe('http-utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = 'test';
    });

    it('writeJSON sends exact payload and status', () => {
        writeJSON(res as any, 201, { ok: true });
        expect(status).toHaveBeenCalledWith(201);
        expect(json).toHaveBeenCalledWith({ ok: true });
    });

    it('writeError logs and returns unified shape with error', () => {
        const err = new Error('boom');
        writeError(res as any, 500, 'Something failed', err);
        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({ message: 'Something failed', error: 'boom' });
    });

    it('writeError without error object returns message as error', () => {
        writeError(res as any, 400, 'Validation failed');
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({
            message: 'Validation failed',
            error: 'Validation failed'
        });
    });

    it('writePaginated computes metadata correctly', () => {
        writePaginated(res as any, [1, 2, 3], 2, 3, 10);
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({
            data: [1, 2, 3],
            pagination: {
                page: 2,
                pageSize: 3,
                total: 10,
                totalPages: Math.ceil(10 / 3),
                hasNext: 2 < Math.ceil(10 / 3),
                hasPrev: true,
            },
        });
    });
});
