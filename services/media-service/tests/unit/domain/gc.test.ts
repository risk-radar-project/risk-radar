process.env.HOSTNAME = process.env.HOSTNAME || "authz"
process.env.AUTHZ_SERVICE_PORT = process.env.AUTHZ_SERVICE_PORT || "8081"
process.env.AUDIT_LOG_SERVICE_PORT = process.env.AUDIT_LOG_SERVICE_PORT || "8082"

const deleteFiles = jest.fn(async () => {})
const loggerMock: any = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() }
let queryCalls: any[] = []

jest.mock("../../../src/storage/fs-storage.js", () => ({
    deleteFiles: (...args: any[]) => (deleteFiles as any)(...args)
}))
jest.mock("../../../src/logger/logger.js", () => ({ logger: loggerMock }))
jest.mock("../../../src/db/pool.js", () => ({
    db: {
        query: jest.fn(async (sql: string, params?: any[]) => {
            queryCalls.push({ sql, params })
            if (sql.startsWith("SELECT id FROM media_assets WHERE deleted=true"))
                return { rows: [{ id: "old-deleted-1" }] } as any
            if (sql.startsWith("SELECT id FROM media_assets WHERE is_temporary=true"))
                return { rows: [{ id: "expired-temp-1" }] } as any
            if (sql.startsWith("DELETE FROM media_assets WHERE id=")) return { rows: [] } as any
            return { rows: [] } as any
        })
    }
}))

import { gc } from "../../../src/domain/gc.js"
import { config } from "../../../src/config/config.js"

describe("gc", () => {
    beforeAll(() => {
        config.gc.enabled = true as any
    })
    beforeEach(() => {
        queryCalls = []
        deleteFiles.mockClear()
    })

    it("runs single iteration removing deleted and expired temporary", async () => {
        await gc.runOnce()
        expect(deleteFiles).toHaveBeenCalledTimes(2)
        const ids = deleteFiles.mock.calls.map((c: any[]) => c[1]).sort()
        expect(ids).toEqual(["expired-temp-1", "old-deleted-1"])
    })
})
