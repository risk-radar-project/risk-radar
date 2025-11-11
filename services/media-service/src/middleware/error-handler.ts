import { Request, Response, NextFunction } from "express"
import { HttpError } from "../errors/http-error.js"
import { logger } from "../logger/logger.js"
import { config } from "../config/config.js"
import { emitAudit } from "../audit/audit-emitter.js"
import { auditEvents } from "../audit/events.js"

/** Global Express error handler producing structured JSON responses. */
export function errorHandler() {
    return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof HttpError) {
            if (err.status === 400) {
                return res.status(400).json({ error: "validation_failed", details: err.details ?? err.message })
            }
            const body: any = { error: err.code || "error", message: err.message }
            if (err.details) body.details = err.details
            const meta = { code: err.code, status: err.status, path: req.originalUrl }
            if (err.status >= 500) {
                logger.error("http_error", meta)
                safeEmitAudit(auditEvents.httpError(req.originalUrl, err.status, err.code))
            } else {
                logger.warn("http_error", meta)
                if (err.status === 401 || err.status === 403 || err.status === 404) {
                    const actorId = (req as any).userId as string | undefined
                    const permission = resolvePermission(err)
                    const reason = resolveReason(err)
                    const endpoint = `${req.method} ${req.originalUrl}`
                    safeEmitAudit(auditEvents.accessDenied(actorId, endpoint, permission, reason))
                }
            }
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
        safeEmitAudit(auditEvents.httpError(req.originalUrl, 500, "INTERNAL_ERROR"))
        const body: any = { error: "internal_error", message: "Unexpected error" }
        if (config.nodeEnv !== "production") {
            body.debug = { message: anyErr?.message, stack }
        }
        return res.status(500).json(body)
    }
}

function safeEmitAudit(event: ReturnType<typeof auditEvents.mediaUploaded>): void {
    void emitAudit(event).catch(err => {
        const error = err instanceof Error ? err.message : String(err)
        logger.warn("audit_emit_failed", { action: event.action, error })
    })
}

function resolvePermission(err: HttpError): string {
    const details = detailsObject(err.details)
    if (details) {
        const permission = details.permission
        if (typeof permission === "string" && permission.trim()) return permission
    }
    if (err.status === 401) return "auth:missing_identity"
    if (err.status === 404) return "media:read"
    return "media:access"
}

function resolveReason(err: HttpError): string {
    if (typeof err.details === "string" && err.details.trim()) return err.details
    const details = detailsObject(err.details)
    if (details) {
        if (typeof details.reason === "string" && details.reason.trim()) return details.reason
        if (typeof details.issue === "string" && details.issue.trim()) return details.issue
        if (typeof details.message === "string" && details.message.trim()) return details.message
    }
    return err.message
}

function detailsObject(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return value as Record<string, any>
}
