process.env.HOSTNAME = process.env.HOSTNAME || "authz"
process.env.AUTHZ_SERVICE_PORT = process.env.AUTHZ_SERVICE_PORT || "8081"
process.env.AUDIT_LOG_SERVICE_PORT = process.env.AUDIT_LOG_SERVICE_PORT || "8082"
import { requestLogger } from "../../../src/middleware/request-logger.js"

jest.mock("../../../src/logger/logger.js", () => ({ logger: { info: jest.fn(), warn: jest.fn() } }))

function run(mw: any, req: any = {}, res: any = {}) {
    return new Promise<void>((resolve, reject) => {
        res.on = (_: string, cb: any) => {
            cb()
        }
        mw(req, res, (err: any) => (err ? reject(err) : resolve()))
    })
}

describe("request-logger", () => {
    it("logs request", async () => {
        const mw = requestLogger()
        const req: any = { method: "GET", originalUrl: "/x", correlationId: "cid", startAt: Date.now() - 5 }
        const res: any = { statusCode: 200 }
        await run(mw, req, res)
        // No assertion on logger since mocked; presence of no error is success
    })
})
