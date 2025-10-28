import request from "supertest"
import { jest } from "@jest/globals"
jest.mock("file-type", () => ({ fileTypeFromBuffer: async () => ({ mime: "image/png" }) }))
jest.mock("../../src/authz/authz-adapter.js", () => ({ hasPermission: jest.fn(async () => true) }))
// Lightweight in-memory DB mock for validation failures
const dbState: any[] = []
jest.mock("../../src/db/pool.js", () => ({
    db: {
        query: async (sql: string, params?: any[]) => {
            if (sql.startsWith("INSERT INTO media_assets")) {
                const rec = {
                    id: params![0],
                    owner_id: params![1],
                    visibility: params![2],
                    status: params![3],
                    deleted: false,
                    alt: params![10]
                }
                dbState.push(rec)
                return { rows: [rec] } as any
            }
            if (sql.startsWith("SELECT * FROM media_assets WHERE id=")) {
                return { rows: dbState.filter(r => r.id === params![0]) }
            }
            return { rows: [] }
        }
    }
}))
import app from "../../src/app.js"

function makeImageBuffer() {
    // 1x1 white PNG
    return Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
        "base64"
    )
}

describe("Media validation (Joi)", () => {
    test("upload rejects invalid visibility", async () => {
        const res = await request(app)
            .post("/media")
            .set("X-User-ID", "11111111-1111-4111-8111-111111111111")
            .attach("file", makeImageBuffer(), { filename: "a.png" })
            .field("visibility", "friends")
        expect(res.status).toBe(400)
        expect(res.body.error).toBe("validation_failed")
    })

    test("list rejects invalid limit", async () => {
        const res = await request(app).get("/media?limit=5000").set("X-User-ID", "11111111-1111-4111-8111-111111111111")
        expect(res.status).toBe(400)
        expect(res.body.error).toBe("validation_failed")
    })

    test("patch clamps censor strength (too high)", async () => {
        // First upload
        const up = await request(app)
            .post("/media")
            .set("X-User-ID", "11111111-1111-4111-8111-111111111111")
            .attach("file", makeImageBuffer(), { filename: "a.png" })
        expect(up.status).toBe(201)
        const id = up.body.id

        const res = await request(app)
            .patch(`/media/${id}`)
            .set("X-User-ID", "11111111-1111-4111-8111-111111111111")
            .send({ censor: { strength: 9999 } })
        expect(res.status).toBe(200) // clamped
    })

    test("bulk keep rejects empty ids", async () => {
        const res = await request(app)
            .post("/media/temporary/keep")
            .set("X-User-ID", "11111111-1111-4111-8111-111111111111")
            .send({ ids: [] })
        expect(res.status).toBe(400)
    })
})
