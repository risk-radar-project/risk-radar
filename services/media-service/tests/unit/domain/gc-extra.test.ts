process.env.HOSTNAME = "authz"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"
// Force error path inside runOnce by throwing on query
const query = jest.fn(async () => {
    throw new Error("db down")
})
jest.mock("../../../src/db/pool.js", () => ({ db: { query } }))
jest.mock("../../../src/logger/logger.js", () => ({ logger: { warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }))
jest.mock("../../../src/config/config.js", () => ({
    config: { gc: { enabled: true, intervalMs: 1000, deleteAfterDays: 30 }, mediaRoot: "." }
}))

import { gc } from "../../../src/domain/gc.js"

describe("gc error path", () => {
    it("handles iteration error safely", async () => {
        await gc.runOnce()
        expect(query).toHaveBeenCalled()
    })
})
