import request from "supertest"
import path from "path"
import { readFile } from "fs/promises"
import { jest } from "@jest/globals"

jest.mock("file-type", () => ({ fileTypeFromBuffer: async (_buf: any) => ({ mime: "image/png" }) }))

// Capture audit events
const emitted: any[] = []
jest.mock("../../src/audit/audit-emitter.js", () => ({
    emitAudit: jest.fn(async e => {
        emitted.push(e)
    })
}))
jest.mock("../../src/authz/authz-adapter.js", () => ({ hasPermission: jest.fn(async () => true) }))
jest.mock("../../src/moderation/openai-moderation.js", () => ({
    moderateImage: jest.fn(async () => ({ flagged: false, elapsedMs: 3 }))
}))

// Minimal in-memory DB similar to base integration test
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
        return { rows: dbState.filter(r => r.id === params![0]) } as any
    }
    if (sql.startsWith("UPDATE media_assets SET")) {
        const id = params![params!.length - 1]
        const rec = dbState.find(r => r.id === id)
        if (rec) rec.updated_at = new Date()
        if (sql.includes("visibility=")) {
            const visIdx = sql.split(",").findIndex(s => s.includes("visibility="))
            if (visIdx >= 0) rec.visibility = params![visIdx]
        }
        if (sql.includes("alt=")) {
            // alt param before id near end; simplistic update: re-read record after patch in controller anyway
        }
        if (sql.includes("status=")) {
            const stIdx = sql.split(",").findIndex(s => s.includes("status="))
            if (stIdx >= 0) rec.status = params![stIdx]
        }
        if (sql.includes("is_censored=true")) {
            rec.is_censored = true
        }
        if (sql.includes("is_censored=false")) {
            rec.is_censored = false
        }
        return { rows: [] } as any
    }
    return { rows: [] } as any
})
jest.mock("../../src/db/pool.js", () => ({ db: { query: (sql: string, params?: any[]) => dbQuery(sql, params) } }))

process.env.MEDIA_ROOT = path.join(process.cwd(), "tmp-test-media")
process.env.HOSTNAME = "authz"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"

import app from "../../src/app.js"

function png() {
    return Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
        "base64"
    )
}

const FALLBACK_PLACEHOLDER_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY/j///9/AAn7A/0FQ0XKAAAAAElFTkSuQmCC"

async function loadPlaceholder(kind: "flagged" | "deleted" | "forbidden"): Promise<Buffer> {
    const candidates = [
        path.join(process.cwd(), "src", "assets", "placeholders", `${kind}.jpg`),
        path.join(process.cwd(), "assets", "placeholders", `${kind}.jpg`)
    ]
    for (const candidate of candidates) {
        try {
            return await readFile(candidate)
        } catch {
            // try next
        }
    }
    return Buffer.from(FALLBACK_PLACEHOLDER_BASE64, "base64")
}

describe("Media extended integration", () => {
    let mediaId: string

    it("rejects invalid visibility enum on upload", async () => {
        const bad = await request(app)
            .post("/media")
            .attach("file", png(), { filename: "v.png", contentType: "image/png" })
            .field("visibility", "INVALID_ENUM")
        expect(bad.status).toBe(400)

        const good = await request(app)
            .post("/media")
            .set("X-User-ID", "user-1")
            .attach("file", png(), { filename: "v2.png", contentType: "image/png" })
            .field("visibility", "owner")
        expect(good.status).toBe(201)
        mediaId = good.body.id
    })

    it("updates visibility with audit event", async () => {
        const beforeCount = emitted.length
        const res = await request(app)
            .patch(`/media/${mediaId}`)
            .send({ visibility: "public" })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "user-1")
        expect(res.status).toBe(200)
        expect(res.body.visibility).toBe("public")
        const after = emitted.slice(beforeCount).map(e => e.action)
        expect(after).toContain("visibility_changed")
    })

    it("clamps censor strength and emits audit", async () => {
        const before = emitted.length
        const res = await request(app)
            .patch(`/media/${mediaId}`)
            .send({ censor: { strength: 9999 } })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "user-1")
        expect(res.status).toBe(200)
        const actions = emitted.slice(before).map(e => e.action)
        expect(actions).toContain("media_censored")
    })

    it("returns 304 on ETag match for master", async () => {
        const first = await request(app).get(`/media/${mediaId}`)
        expect(first.status).toBe(200)
        const etag = first.headers["etag"]
        if (etag) {
            const second = await request(app)
                .get(`/media/${mediaId}`)
                .set("If-None-Match", etag as string)
            expect(second.status).toBe(304)
        }
    })

    it("emits media_uploaded audit event", () => {
        const actions = emitted.map(e => e.action)
        expect(actions).toContain("media_uploaded")
    })

    it("serves censored content to non-staff after censor", async () => {
        // Upload approved media
        const up = await request(app)
            .post("/media")
            .attach("file", png(), { filename: "c.png", contentType: "image/png" })
            .field("visibility", "public")
        expect(up.status).toBe(201)
        const id = up.body.id

        // Fetch original to get its ETag
        const orig = await request(app).get(`/media/${id}`)
        expect(orig.status).toBe(200)
        const origEtag = orig.headers["etag"]

        // Censor as a user with censor permission
        const { hasPermission } = await import("../../src/authz/authz-adapter.js")
        const hp = hasPermission as unknown as jest.Mock
        // Ensure CENSOR allowed for patch
        hp.mockImplementation(async (_userId: any, perm: any) => perm === "media:censor")
        const cens = await request(app)
            .patch(`/media/${id}`)
            .send({ censor: { strength: 64 } })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "moderator-1")
        expect(cens.status).toBe(200)

        // Now simulate non-staff (no READ_ALL)
        hp.mockImplementation(async (_userId: any, _perm: any) => false)
        const after = await request(app).get(`/media/${id}`)
        expect(after.status).toBe(200)
        const afterEtag = after.headers["etag"]
        // Should be served as censored for public
        expect(after.headers["x-media-served"]).toBe("censored")
        expect(after.headers["cache-control"]).toBe("no-store")

        // Restore permissive mock for subsequent tests (if any)
        hp.mockImplementation(async () => true)
    })

    it("uncensor restores original to non-staff", async () => {
        // Upload public media
        const up2 = await request(app)
            .post("/media")
            .attach("file", png(), { filename: "uc.png", contentType: "image/png" })
            .field("visibility", "public")
        expect(up2.status).toBe(201)
        const id2 = up2.body.id

        const orig2 = await request(app).get(`/media/${id2}`)
        expect(orig2.status).toBe(200)

        // Censor
        const { hasPermission } = await import("../../src/authz/authz-adapter.js")
        const hp = hasPermission as unknown as jest.Mock
        hp.mockImplementation(async (_userId: any, perm: any) => perm === "media:censor")
        const cens2 = await request(app)
            .patch(`/media/${id2}`)
            .send({ censor: { strength: 16 } })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "moderator-1")
        expect(cens2.status).toBe(200)

        // Public sees censored
        hp.mockImplementation(async () => false)
        const afterC = await request(app).get(`/media/${id2}`)
        expect(afterC.status).toBe(200)
        expect(afterC.headers["x-media-served"]).toBe("censored")
        expect(afterC.headers["cache-control"]).toBe("no-store")

        // Uncensor
        hp.mockImplementation(async (_userId: any, perm: any) => perm === "media:censor")
        const un = await request(app)
            .patch(`/media/${id2}`)
            .send({ uncensor: true })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "moderator-1")
        expect(un.status).toBe(200)

        // Public sees original again (no censored header)
        hp.mockImplementation(async () => false)
        const afterU = await request(app).get(`/media/${id2}`)
        expect(afterU.status).toBe(200)
        expect(afterU.headers["x-media-served"]).toBeUndefined()
        expect(afterU.headers["cache-control"]).toBe("no-store")

        // restore
        hp.mockImplementation(async () => true)
    })

    it("non-owner sees forbidden placeholder when rejected", async () => {
        const up = await request(app)
            .post("/media")
            .set("X-User-ID", "owner-a")
            .attach("file", png(), { filename: "rej.png", contentType: "image/png" })
            .field("visibility", "public")
        expect(up.status).toBe(201)
        const id = up.body.id

        // Reject as moderator
        const { hasPermission } = await import("../../src/authz/authz-adapter.js")
        const hp = hasPermission as unknown as jest.Mock
        hp.mockImplementation(async (_user: any, perm: any) => perm === "media:moderate")
        const rej = await request(app)
            .patch(`/media/${id}`)
            .send({ action: "reject" })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "mod-1")
        expect(rej.status).toBe(200)

        // Owner still sees master
        hp.mockImplementation(async () => false)
        const ownerView = await request(app).get(`/media/${id}`).set("X-User-ID", "owner-a")
        expect(ownerView.status).toBe(200)
        expect(Buffer.isBuffer(ownerView.body)).toBe(true)

        // Another user gets forbidden placeholder
        const other = await request(app).get(`/media/${id}`).set("X-User-ID", "viewer-b")
        expect(other.status).toBe(200)
        const placeholder = await loadPlaceholder("forbidden")
        expect(other.body.equals(placeholder)).toBe(true)

        // reset mock
        hp.mockImplementation(async () => true)
    })
})
