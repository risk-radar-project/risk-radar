/** Generic HTTP error carrying status, code and optional details payload. */
export class HttpError extends Error {
    public readonly status: number
    public readonly code?: string
    public readonly details?: unknown

    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message)
        this.status = status
        this.code = code
        this.details = details
    }
}

const shapeDetails = (reason: string, meta?: Record<string, unknown>) => (meta ? { reason, ...meta } : reason)

/** Convenience creators for common HTTP error shapes. */
export const errors = {
    validation: (details: string[] | string) => new HttpError(400, "Validation failed", "VALIDATION_ERROR", details),
    unauthorized: (reason = "Authentication required", meta?: Record<string, unknown>) =>
        new HttpError(401, "Unauthorized", "UNAUTHORIZED", shapeDetails(reason, meta)),
    notFound: (reason = "Not found", meta?: Record<string, unknown>) =>
        new HttpError(404, "Not found", "NOT_FOUND", shapeDetails(reason, meta)),
    forbidden: (reason = "Forbidden", meta?: Record<string, unknown>) =>
        new HttpError(403, "Forbidden", "FORBIDDEN", shapeDetails(reason, meta)),
    unsupported: (message = "Unsupported media type") => new HttpError(415, message, "UNSUPPORTED_MEDIA_TYPE"),
    tooLarge: (message = "Payload too large") => new HttpError(413, message, "PAYLOAD_TOO_LARGE"),
    unprocessable: (message = "Unprocessable entity", details?: unknown) =>
        new HttpError(422, message, "UNPROCESSABLE_ENTITY", details),
    internal: (message = "Internal server error") => new HttpError(500, message, "INTERNAL_ERROR"),
    dependencyUnavailable: (service: string, message = "Dependency unavailable") =>
        new HttpError(503, message, "DEPENDENCY_UNAVAILABLE", { service })
}
