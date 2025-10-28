import { requestContext } from "../../../src/middleware/request-context.js"

function runMw(mw: any, req: any = {}, res: any = {}) {
    return new Promise<void>((resolve, reject) => {
        mw(req, res, (err: any) => (err ? reject(err) : resolve()))
    })
}

describe("request-context", () => {
    it("adds userId and startedAt", async () => {
        const mw = requestContext()
        const req: any = { headers: {}, header: (name: string) => undefined }
        const res: any = {}
        await runMw(mw, req, res)
        expect(req.userId).toBeUndefined()
        expect(typeof req.startedAt).toBe("number")
    })
})
