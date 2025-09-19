/** Generic HTTP error carrying status, code and optional details payload. */
export class HttpError extends Error {
    public readonly status: number;
    public readonly code?: string;
    public readonly details?: unknown;

    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

/** Convenience creators for common HTTP error shapes. */
export const errors = {
    validation: (details: string[] | string) => new HttpError(400, 'Validation failed', 'VALIDATION_ERROR', details),
    notFound: (message = 'Not found') => new HttpError(404, 'Not found', 'NOT_FOUND', message),
    forbidden: (message = 'Forbidden') => new HttpError(403, 'Forbidden', 'FORBIDDEN', message),
    unsupported: (message = 'Unsupported media type') => new HttpError(415, message, 'UNSUPPORTED_MEDIA_TYPE'),
    tooLarge: (message = 'Payload too large') => new HttpError(413, message, 'PAYLOAD_TOO_LARGE'),
    unprocessable: (message = 'Unprocessable entity', details?: unknown) => new HttpError(422, message, 'UNPROCESSABLE_ENTITY', details),
    internal: (message = 'Internal server error') => new HttpError(500, message, 'INTERNAL_ERROR'),
    dependencyUnavailable: (service: string, message = 'Dependency unavailable') => new HttpError(503, message, 'DEPENDENCY_UNAVAILABLE', { service }),
};
