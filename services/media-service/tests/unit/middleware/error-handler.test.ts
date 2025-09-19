process.env.HOSTNAME = 'authz.local';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';

import { errors } from '../../../src/errors/http-error';
import { errorHandler } from '../../../src/middleware/error-handler';
import { Request, Response, NextFunction } from 'express';

interface TestResult { status: number; body: any }

function runError(err: any): Promise<TestResult> {
    return new Promise(resolve => {
        const req = {} as Request;
        const base: any = {
            statusCode: 0,
            jsonPayload: null,
            status(code: number) { this.statusCode = code; return this; },
            json(p: any) { this.jsonPayload = p; resolve({ status: this.statusCode, body: p }); }
        };
        const res = base as Response & { statusCode: number };
        const next: NextFunction = () => { };
        (errorHandler() as any)(err, req, res, next);
    });
}

describe('error-handler', () => {
    test('HttpError returns structured payload', async () => {
        const err = errors.forbidden('nope');
        const r = await runError(err);
        expect(r.status).toBe(403);
        expect(r.body.error).toBe('FORBIDDEN');
    });

    test('generic error returns 500', async () => {
        const err = new Error('boom');
        const r = await runError(err);
        expect(r.status).toBe(500);
        expect(r.body.error).toBe('internal_error');
    });
});
