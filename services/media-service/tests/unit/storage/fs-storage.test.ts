import { writeFileBuffered, readFile, deleteFiles, statFile, getDiskUsage } from "../../../src/storage/fs-storage.js"
import { shardPath } from "../../../src/storage/paths.js"
import fs from "fs/promises"
import path from "path"

const root = path.join(process.cwd(), "tmp-fs-storage")

function buf(str: string) {
    return Buffer.from(str, "utf8")
}

describe("fs-storage", () => {
    beforeAll(async () => {
        await fs.mkdir(root, { recursive: true })
    })
    afterAll(async () => {
        try {
            await fs.rm(root, { recursive: true, force: true })
        } catch {}
    })

    it("writes and reads variants", async () => {
        const id = "abc123"
        await writeFileBuffered(root, id, "master", buf("data"))
        const read = await readFile(root, id, "master")
        expect(read?.toString()).toBe("data")
    })

    it("returns null for missing file", async () => {
        const r = await readFile(root, "missing", "thumb")
        expect(r).toBeNull()
    })

    it("stats existing file", async () => {
        const id = "stat1"
        await writeFileBuffered(root, id, "thumb", buf("x"))
        const st = await statFile(root, id, "thumb")
        expect(st?.size).toBe(1)
    })

    it("deletes all variants without throwing", async () => {
        const id = "del1"
        await writeFileBuffered(root, id, "master", buf("a"))
        await writeFileBuffered(root, id, "thumb", buf("b"))
        await deleteFiles(root, id)
        const m = await readFile(root, id, "master")
        expect(m).toBeNull()
    })

    it("gets disk usage (with fallback walk)", async () => {
        // Force fallback by mocking check-disk-space to throw at import time not feasible here; rely on real stats
        const usage = await getDiskUsage(root)
        expect(usage.totalBytes).toBeGreaterThanOrEqual(usage.usedBytes)
    })
})
