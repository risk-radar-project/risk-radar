import request from "supertest"
import http from "http"
import path from "path"
import { promises as fs } from "fs"
import type { AddressInfo } from "net"
import { jest } from "@jest/globals"

jest.mock("file-type", () => ({ fileTypeFromBuffer: async (_buf: any) => ({ mime: "image/png" }) }))

const dbState: any[] = []
const dbQuery = jest.fn(async (sql: string, params?: any[]) => {
    sql = sql.trim()
    if (sql.startsWith("INSERT INTO media_assets")) {
        const id = params![0]
        const rec = {
            id,
            owner_id: params![1] || null,
            visibility: params![2],
            status: params![3],
            deleted: false,
            is_censored: false,
            content_type: "image/jpeg",
            size_bytes: params![5],
            width: params![6],
            height: params![7],
            content_hash: params![8],
            original_filename: params![9],
            alt: params![10],
            tags: null,
            collection: null,
            moderation_flagged: params![12],
            moderation_decision_time_ms: params![13],
            is_temporary: params![14],
            expires_at: params![15],
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null
        }
        dbState.push(rec)
        return { rows: [rec] } as any
    }
    if (sql.startsWith("SELECT * FROM media_assets WHERE id=")) {
        const id = params![0]
        return { rows: dbState.filter(r => r.id === id) } as any
    }
    return { rows: [] } as any
})
jest.mock("../../src/db/pool.js", () => ({ db: { query: (sql: string, params?: any[]) => dbQuery(sql, params) } }))

jest.mock("../../src/moderation/openai-moderation.js", () => ({
    moderateImage: jest.fn(async () => ({ flagged: false, elapsedMs: 5 }))
}))
jest.mock("../../src/authz/authz-adapter.js", () => ({ hasPermission: jest.fn(async () => true) }))

const publishAuditEventMock = jest.fn()
jest.mock("../../src/audit/kafka-publisher.js", () => ({
    publishAuditEvent: publishAuditEventMock,
    isKafkaEnabled: jest.fn(() => false)
}))

const mediaRoot = path.join(process.cwd(), "tmp-test-media-http")
process.env.MEDIA_ROOT = mediaRoot
process.env.HOSTNAME = "media-http"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_KAFKA_ENABLED = "false"
process.env.AUDIT_KAFKA_BROKERS = ""
process.env.AUDIT_LOG_SERVICE_PORT = "8082"
process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db"

let app: any
let auditServer: http.Server
const auditRequests: any[] = []

beforeAll(async () => {
    auditServer = http.createServer((req, res) => {
        if (req.method === "POST" && req.url === "/logs") {
            let body = ""
            req.setEncoding("utf8")
            req.on("data", chunk => (body += chunk))
            req.on("end", () => {
                try {
                    auditRequests.push(JSON.parse(body))
                } catch {
                    auditRequests.push(body)
                }
                res.writeHead(201).end("ok")
            })
            return
        }
        res.writeHead(404).end()
    })
    await new Promise<void>(resolve => auditServer.listen(0, resolve))
    const address = auditServer.address() as AddressInfo
    process.env.AUDIT_BASE_URL = `http://127.0.0.1:${address.port}`
    jest.resetModules()
    app = (await import("../../src/app.js")).default
})

afterAll(async () => {
    await new Promise<void>(resolve => auditServer.close(() => resolve()))
    await fs.rm(mediaRoot, { recursive: true, force: true })
})

beforeEach(() => {
    publishAuditEventMock.mockClear()
    auditRequests.length = 0
    dbState.length = 0
})

afterEach(async () => {
    await fs.rm(mediaRoot, { recursive: true, force: true })
})

function makePngBuffer() {
    return Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
        "base64"
    )
}

describe("Audit HTTP fallback", () => {
    it("delivers audit events via HTTP when Kafka is disabled", async () => {
        const buf = makePngBuffer()
        const res = await request(app)
            .post("/media")
            .set("X-User-ID", "http-user")
            .attach("file", buf, { filename: "audit-http.png", contentType: "image/png" })
        expect(res.status).toBe(201)
        expect(auditRequests.length).toBe(1)
        const payload = auditRequests[0]
        expect(payload).toEqual(
            expect.objectContaining({
                service: "media-service",
                action: "media_uploaded",
                actor: expect.objectContaining({ id: "http-user" })
            })
        )
        expect(publishAuditEventMock).not.toHaveBeenCalled()
    })
})
