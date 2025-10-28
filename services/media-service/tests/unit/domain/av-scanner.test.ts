process.env.HOSTNAME = "authz"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"
import { scanBuffer } from "../../../src/domain/av-scanner.js"

describe("av-scanner stub", () => {
    it("returns no detection", async () => {
        const r = await scanBuffer(Buffer.from("x"))
        expect(r.detected === false || r.detected === undefined).toBe(true)
    })
})
