import request from "supertest"
import path from "path"
import { promises as fs } from "fs"
import { jest } from "@jest/globals"

// Mock ESM-only dependency 'file-type' to avoid Jest ESM parsing issues
jest.mock("file-type", () => ({ fileTypeFromBuffer: async (_buf: any) => ({ mime: "image/png" }) }))

// Simple in-memory DB mock supporting patterns used in controller
const dbState: any[] = []
const dbQuery = jest.fn(async (sql: string, params?: any[]) => {
    sql = sql.trim()
    if (sql.startsWith("INSERT INTO media_assets")) {
        if (!params || !params[1]) {
            throw new Error('null value in column "owner_id" violates not-null constraint')
        }
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
    if (sql.startsWith("UPDATE media_assets SET is_temporary=false")) {
        // keepTemporary endpoint
        const ids = params as string[]
        const kept: any[] = []
        for (const id of ids) {
            const rec = dbState.find(r => r.id === id && r.is_temporary && !r.deleted)
            if (rec) {
                rec.is_temporary = false
                rec.expires_at = null
                rec.updated_at = new Date()
                kept.push({ id })
            }
        }
        return { rows: kept } as any
    }
    if (sql.startsWith("SELECT id, owner_id FROM media_assets WHERE deleted=false AND id IN")) {
        const ids = params as string[]
        return {
            rows: dbState
                .filter(r => ids.includes(r.id) && r.deleted === false)
                .map(r => ({ id: r.id, owner_id: r.owner_id }))
        } as any
    }
    if (sql.startsWith("SELECT id, owner_id, deleted FROM media_assets WHERE id IN")) {
        const ids = params as string[]
        return {
            rows: dbState
                .filter(r => ids.includes(r.id))
                .map(r => ({ id: r.id, owner_id: r.owner_id, deleted: r.deleted }))
        } as any
    }
    if (sql.startsWith("SELECT * FROM media_assets WHERE id IN")) {
        const ids = params as string[]
        return { rows: dbState.filter(r => ids.includes(r.id) && !r.deleted) } as any
    }
    if (sql.startsWith("UPDATE media_assets SET deleted=true, deleted_at=now(), updated_at=now() WHERE id=")) {
        // single delete (remove endpoint)
        const id = params![0]
        const rec = dbState.find(r => r.id === id)
        if (rec) {
            rec.deleted = true
            rec.deleted_at = new Date()
            rec.updated_at = new Date()
        }
        return { rows: [] } as any
    }
    if (sql.startsWith("UPDATE media_assets SET deleted=true")) {
        // rejectTemporary bulk
        const ids = params as string[]
        const rej: any[] = []
        for (const id of ids) {
            const rec = dbState.find(r => r.id === id)
            if (rec && !rec.deleted) {
                rec.deleted = true
                rec.deleted_at = new Date()
                rec.updated_at = new Date()
                rej.push({ id })
            }
        }
        return { rows: rej } as any
    }
    if (sql.startsWith("UPDATE media_assets SET")) {
        // patch variations (visibility / alt / status)
        const id = params![params!.length - 1]
        const rec = dbState.find(r => r.id === id)
        if (rec) rec.updated_at = new Date()
        return { rows: [] } as any
    }
    if (sql.startsWith("SELECT * FROM media_assets WHERE")) {
        // list
        return { rows: [...dbState] } as any
    }
    return { rows: [] } as any
})
jest.mock("../../src/db/pool.js", () => ({ db: { query: (sql: string, params?: any[]) => dbQuery(sql, params) } }))

jest.mock("../../src/moderation/openai-moderation.js", () => ({
    moderateImage: jest.fn(async () => ({ flagged: false, elapsedMs: 5 }))
}))
jest.mock("../../src/audit/audit-emitter.js", () => ({ emitAudit: jest.fn(async () => { }) }))
const mockHasPermission = jest.fn(async (_userId: string, _permission: string) => true)
jest.mock("../../src/authz/authz-adapter.js", () => ({
    hasPermission: (userId: string, permission: string) => mockHasPermission(userId, permission)
}))

process.env.MEDIA_ROOT = path.join(process.cwd(), "tmp-test-media")
process.env.HOSTNAME = "authz"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"

const mediaRoot = process.env.MEDIA_ROOT!

import app from "../../src/app.js"

function makePngBuffer() {
    return Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
        "base64"
    )
}

describe("Media integration", () => {
    beforeEach(async () => {
        await fs.rm(mediaRoot, { recursive: true, force: true })
        dbState.length = 0
        dbQuery.mockClear()
        mockHasPermission.mockReset()
        mockHasPermission.mockImplementation(async (_userId: string, _permission: string) => true)
    })

    it("rejects upload when X-User-ID header is missing", async () => {
        const beforeFiles = await collectFiles(mediaRoot)
        const buf = makePngBuffer()
        const res = await request(app)
            .post("/media")
            .attach("file", buf, { filename: "missing-user.png", contentType: "image/png" })
        expect(res.status).toBe(401)
        const afterFiles = await collectFiles(mediaRoot)
        expect(afterFiles).toEqual(beforeFiles)
    })

    it("cleans up staged files when persistence fails", async () => {
        dbQuery.mockImplementationOnce(async () => {
            throw new Error("insert failed")
        })
        const buf = makePngBuffer()
        const res = await request(app)
            .post("/media")
            .set("X-User-ID", "cleanup-user")
            .attach("file", buf, { filename: "cleanup.png", contentType: "image/png" })
        expect(res.status).toBe(500)
        const remainingFiles = await collectFiles(mediaRoot)
        expect(remainingFiles.length).toBe(0)
    })

    it("uploads temporary media", async () => {
        const id = await uploadTemporaryAsset("user-temp")
        expect(id).toBeTruthy()
    })

    it("keeps temporary media", async () => {
        const tempId = await uploadTemporaryAsset("user-temp")
        const res = await request(app)
            .post("/media/temporary/keep")
            .send({ ids: [tempId] })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "user-temp")
        expect(res.status).toBe(200)
        expect(res.body.kept).toContain(tempId)
        // fetch to verify updated state
        const getRes = await request(app).get(`/media/${tempId}`)
        expect(getRes.status).toBe(200)
    })

    it("rejects temporary media (bulk)", async () => {
        // upload separate temp
        const rejectId = await uploadTemporaryAsset("user-temp")
        const res = await request(app)
            .post("/media/temporary/reject")
            .send({ ids: [rejectId] })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "user-temp")
        expect(res.status).toBe(200)
        expect(res.body.rejected).toContain(rejectId)
        // subsequent fetch returns placeholder (deleted)
        const getDel = await request(app).get(`/media/${rejectId}`)
        expect(getDel.status).toBe(200)
    })

    it("returns 403 when keeping someone else's temporary without permission", async () => {
        const tempId = await uploadTemporaryAsset("owner-1")
        mockHasPermission.mockImplementation(async (userId: string, _permission: string) => userId !== "intruder")
        const res = await request(app)
            .post("/media/temporary/keep")
            .send({ ids: [tempId] })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "intruder")
        expect(res.status).toBe(403)
    })

    it("returns 403 when rejecting someone else's temporary without permission", async () => {
        const tempId = await uploadTemporaryAsset("owner-2")
        mockHasPermission.mockImplementation(async (userId: string, permission: string) => {
            if (userId === "intruder" && permission === "media:delete") return false
            return true
        })
        const res = await request(app)
            .post("/media/temporary/reject")
            .send({ ids: [tempId] })
            .set("Content-Type", "application/json")
            .set("X-User-ID", "intruder")
        expect(res.status).toBe(403)
    })

    it("uploads flagged media when moderation flags", async () => {
        const { moderateImage } = await import("../../src/moderation/openai-moderation.js")
        // enable moderation and force flag
        const { config } = await import("../../src/config/config.js")
        config.moderation.enabled = true as any
            ; (moderateImage as any).mockResolvedValueOnce({ flagged: true, elapsedMs: 7 })
        const buf = makePngBuffer()
        const res = await request(app)
            .post("/media")
            .set("X-User-ID", "user-flag")
            .attach("file", buf, { filename: "flagged.png", contentType: "image/png" })
        expect(res.status).toBe(201)
        expect(res.body.status).toBe("flagged")
        const master = await request(app).get(`/media/${res.body.id}`)
        expect(master.status).toBe(200) // served placeholder due to flagged/not approved
    })

    it("deletes media", async () => {
        const buf = makePngBuffer()
        const up = await request(app)
            .post("/media")
            .set("X-User-ID", "user-1")
            .attach("file", buf, { filename: "del.png", contentType: "image/png" })
        const id = up.body.id
        const del = await request(app).delete(`/media/${id}`).set("X-User-ID", "user-1")
        expect(del.status).toBe(204)
        const master = await request(app).get(`/media/${id}`)
        expect(master.status).toBe(200) // placeholder for deleted asset
    })
})

async function collectFiles(root: string): Promise<string[]> {
    const files: string[] = []
    const walk = async (dir: string) => {
        let entries: any[]
        try {
            entries = await fs.readdir(dir, { withFileTypes: true } as any)
        } catch (err: any) {
            if (err && err.code === "ENOENT") return
            throw err
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                await walk(full)
            } else if (entry.isFile()) {
                files.push(path.relative(root, full))
            }
        }
    }
    await walk(root)
    return files.sort()
}

async function uploadTemporaryAsset(ownerId: string): Promise<string> {
    const buf = makePngBuffer()
    const res = await request(app)
        .post("/media?temporary=1")
        .set("X-User-ID", ownerId)
        .attach("file", buf, { filename: "temp.png", contentType: "image/png" })
    if (res.status !== 201) {
        throw new Error(`Upload failed with status ${res.status}`)
    }
    return res.body.id as string
}
