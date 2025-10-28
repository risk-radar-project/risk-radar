import { Request, Response, NextFunction } from "express"
import { HttpError } from "../errors/http-error.js"
import { logger } from "../logger/logger.js"
import { config } from "../config/config.js"

/** Global Express error handler producing structured JSON responses. */
export function errorHandler() {
    return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof HttpError) {
            if (err.status === 400) {
                return res.status(400).json({ error: "validation_failed", details: err.details ?? err.message })
            }
            const body: any = { error: err.code || "error", message: err.message }
            if (err.details) body.details = err.details
            // For 5xx escalate logging; 4xx keep warn
            const meta = { code: err.code, status: err.status, path: req.originalUrl }
            if (err.status >= 500) logger.error("http_error", meta)
            else logger.warn("http_error", meta)
            return res.status(err.status).json(body)
        }

        const anyErr = err as any
        const stack = anyErr?.stack
        logger.error("http_error", {
            code: "INTERNAL_ERROR",
            status: 500,
            path: req.originalUrl,
            error_message: anyErr?.message,
            stack
        })
        const body: any = { error: "internal_error", message: "Unexpected error" }
        if (config.nodeEnv !== "production") {
            body.debug = { message: anyErr?.message, stack }
        }
        return res.status(500).json(body)
    }
}
