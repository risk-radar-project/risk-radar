process.env.HOSTNAME = "authz.local"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"

jest.mock("../../../src/audit/audit-emitter.js", () => ({ emitAudit: jest.fn(() => Promise.resolve()) }))
jest.mock("../../../src/logger/logger.js", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}))

import { errors } from "../../../src/errors/http-error"
import { errorHandler } from "../../../src/middleware/error-handler"
import { Request, Response, NextFunction } from "express"

interface TestResult {
    status: number
    body: any
}

function runError(err: any, reqOverrides: Partial<Request & { userId?: string }> = {}): Promise<TestResult> {
    return new Promise(resolve => {
        const req = {
            method: "GET",
            originalUrl: "/test",
            ...reqOverrides
        } as Request
        if (reqOverrides && "userId" in reqOverrides) {
            ; (req as any).userId = (reqOverrides as any).userId
        }
        const base: any = {
            statusCode: 0,
            jsonPayload: null,
            status(code: number) {
                this.statusCode = code
                return this
            },
            json(p: any) {
                this.jsonPayload = p
                resolve({ status: this.statusCode, body: p })
            }
        }
        const res = base as Response & { statusCode: number }
        const next: NextFunction = () => { }
            ; (errorHandler() as any)(err, req, res, next)
    })
}

describe("error-handler", () => {
    const { emitAudit } = require("../../../src/audit/audit-emitter.js")

    beforeEach(() => {
        emitAudit.mockClear()
    })

    test("HttpError returns structured payload", async () => {
        const err = errors.forbidden("nope")
        const r = await runError(err)
        expect(r.status).toBe(403)
        expect(r.body.error).toBe("FORBIDDEN")
    })

    test("forbidden responses trigger audit", async () => {
        const err = errors.forbidden("Insufficient permissions", { permission: "media:test", issue: "missing" })
        const r = await runError(err, { originalUrl: "/media/1", method: "PATCH", userId: "user-1" } as any)
        expect(r.status).toBe(403)
        expect(emitAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "access_denied",
                actor: expect.objectContaining({ id: "user-1" }),
                metadata: expect.objectContaining({ permission: "media:test", reason: expect.any(String) })
            })
        )
    })

    test("internal errors emit http error audit", async () => {
        const err = new Error("boom")
        const r = await runError(err)
        expect(r.status).toBe(500)
        expect(r.body.error).toBe("internal_error")
        expect(emitAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "http_error",
                metadata: expect.objectContaining({ status: 500 })
            })
        )
    })

    test("generic error returns 500", async () => {
        const err = new Error("boom")
        const r = await runError(err)
        expect(r.status).toBe(500)
        expect(r.body.error).toBe("internal_error")
    })
})
