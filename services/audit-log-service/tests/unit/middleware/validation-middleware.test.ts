/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Joi from 'joi';
import { validateRequest } from '../../../src/middleware/validation';

const makeRes = () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    return { status, json } as any;
};

const makeReq = (overrides: any = {}) => ({
    method: 'GET',
    path: '/x',
    body: {},
    query: {},
    params: {},
    ...overrides
}) as any;

jest.mock('../../../src/utils/logger', () => ({
    logger: { warn: jest.fn() },
}));

describe('validateRequest middleware', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls next when there are no schemas and no errors', () => {
        const req = makeReq();
        const res = makeRes();
        const next = jest.fn();

        validateRequest({} as any)(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 400 and aggregates body validation errors', () => {
        const schema = Joi.object({ name: Joi.string().required() });
        const req = makeReq({ body: {} });
        const res = makeRes();
        const next = jest.fn();

        validateRequest({ body: schema })(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.status(400).json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Validation failed', details: expect.any(Array) })
        );
        expect((res.status(400).json as any).mock.calls[0][0].details.length)
            .toBeGreaterThanOrEqual(1);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid query and preserves details', () => {
        const schema = Joi.object({ page: Joi.number().integer().min(1).required() });
        const req = makeReq({ query: { page: 0 } });
        const res = makeRes();
        const next = jest.fn();

        validateRequest({ query: schema })(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid params', () => {
        const schema = Joi.object({ id: Joi.string().uuid().required() });
        const req = makeReq({ params: { id: 'not-a-uuid' } });
        const res = makeRes();
        const next = jest.fn();

        validateRequest({ params: schema })(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('aggregates multiple errors from body and query', () => {
        const bodySchema = Joi.object({ a: Joi.number().required() });
        const querySchema = Joi.object({ b: Joi.string().email().required() });
        const req = makeReq({ body: {}, query: { b: 'no-email' } });
        const res = makeRes();
        const next = jest.fn();

        validateRequest({ body: bodySchema, query: querySchema })(req, res, next);

        const payload = (res.status(400).json as any).mock.calls[0][0];
        expect(res.status).toHaveBeenCalledWith(400);
        expect(Array.isArray(payload.details)).toBe(true);
        expect(payload.details.length).toBeGreaterThanOrEqual(2);
        expect(next).not.toHaveBeenCalled();
    });

    it('passes when query is valid and assigns coerced values back to req.query', () => {
        const schema = Joi.object({ page: Joi.number().integer().min(1).default(1) });
        const req = makeReq({ query: { page: '2' } });
        const res = makeRes();
        const next = jest.fn();

        validateRequest({ query: schema })(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.query.page).toBe(2); // coerced to number by Joi
    });
});
