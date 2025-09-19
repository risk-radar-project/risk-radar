import { Request, Response, NextFunction } from 'express';

/** Attach userId (from X-User-ID) & start timestamp to request object. */
export function requestContext() {
    return (req: Request, _res: Response, next: NextFunction) => {
        // Internal request id for logs and audit metadata only; not propagated as a header.
        const userId = req.header('X-User-ID') || undefined;
        (req as any).userId = userId;
        (req as any).startedAt = Date.now();
        next();
    };
}
