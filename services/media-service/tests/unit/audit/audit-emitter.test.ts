process.env.HOSTNAME = "authz"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"

const execMock = jest.fn(async (fn: any) => fn())
const breakerMock = { exec: (fn: any) => execMock(fn) }
const publishAuditEventMock = jest.fn()
const isKafkaEnabledMock = jest.fn()

jest.mock("../../../src/domain/circuit-breaker.js", () => ({
    CircuitBreaker: class {
        constructor(_: any) {}
        exec = (fn: any) => fn()
    },
    registerBreaker: jest.fn(),
    getBreaker: jest.fn(() => breakerMock)
}))

jest.mock("axios", () => ({ post: jest.fn().mockResolvedValue({ status: 201 }) }))
jest.mock("../../../src/logger/logger.js", () => ({ logger: { warn: jest.fn(), debug: jest.fn() } }))
jest.mock("../../../src/audit/kafka-publisher.js", () => ({
    publishAuditEvent: publishAuditEventMock,
    isKafkaEnabled: isKafkaEnabledMock
}))

import { emitAudit } from "../../../src/audit/audit-emitter.js"
import { auditEvents } from "../../../src/audit/events.js"

describe("audit-emitter", () => {
    const axios = require("axios")
    const { logger } = require("../../../src/logger/logger.js")

    beforeEach(() => {
        execMock.mockClear()
        publishAuditEventMock.mockReset()
        publishAuditEventMock.mockResolvedValue(undefined)
        isKafkaEnabledMock.mockReset()
        isKafkaEnabledMock.mockReturnValue(true)
        axios.post.mockReset()
        axios.post.mockResolvedValue({ status: 201 })
        logger.warn.mockClear()
        logger.debug.mockClear()
    })

    it("publishes via kafka when enabled", async () => {
        const ev = auditEvents.mediaDeleted("u1", "m1")
        await expect(emitAudit(ev)).resolves.toBeUndefined()
        expect(publishAuditEventMock).toHaveBeenCalledWith(ev)
        expect(axios.post).not.toHaveBeenCalled()
    })

    it("falls back to http when kafka publish fails", async () => {
        publishAuditEventMock.mockRejectedValueOnce(new Error("broker down"))
        const ev = auditEvents.mediaDeleted("u2", "m2")
        await emitAudit(ev)
        expect(publishAuditEventMock).toHaveBeenCalledTimes(1)
        expect(axios.post).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(
            "audit_kafka_publish_failed",
            expect.objectContaining({ fallback: "http" })
        )
    })

    it("logs warning when http fallback exhausts retries", async () => {
        isKafkaEnabledMock.mockReturnValue(false)
        axios.post.mockRejectedValue(new Error("net"))
        const ev = auditEvents.mediaDeleted("u3", "m3")
        await emitAudit(ev)
        expect(publishAuditEventMock).not.toHaveBeenCalled()
        expect(execMock).toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(
            "audit_http_fallback_failed",
            expect.objectContaining({ error: "net" })
        )
    })
})
