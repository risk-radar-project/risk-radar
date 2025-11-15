process.env.HOSTNAME = "authz"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"
jest.mock("../../../src/authz/authz-adapter.js", () => ({
    hasPermission: jest.fn(async (u: string, p: string) => u === "staff")
}))
import { canViewMaster } from "../../../src/domain/policy.js"

describe("policy canViewMaster extra", () => {
    it("returns false for anonymous non-public", async () => {
        expect(await canViewMaster(undefined, "owner", "approved", "owner")).toBe(false)
    })
    it("allows staff via permission", async () => {
        expect(await canViewMaster("staff", "owner", "flagged", "owner")).toBe(true)
    })
})
