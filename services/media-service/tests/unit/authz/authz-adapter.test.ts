process.env.HOSTNAME = process.env.HOSTNAME || "authz"
process.env.AUTHZ_SERVICE_PORT = process.env.AUTHZ_SERVICE_PORT || "8081"
process.env.AUDIT_LOG_SERVICE_PORT = process.env.AUDIT_LOG_SERVICE_PORT || "8082"
import { hasPermission } from "../../../src/authz/authz-adapter.js"
import { getBreaker } from "../../../src/domain/circuit-breaker.js"
import axios from "axios"

jest.mock("axios")
const mockedAxios = axios as any

describe("authz-adapter breaker", () => {
    beforeEach(() => {
        mockedAxios.get.mockRejectedValue(new Error("timeout"))
    })

    it("opens breaker after repeated failures and then throws dependency error fast", async () => {
        const breaker = getBreaker("authz")
        expect(breaker).toBeTruthy()
        for (let i = 0; i < 6; i++) {
            await expect(hasPermission("user1", "PERM")).rejects.toHaveProperty("status", 503)
        }
        await expect(hasPermission("user1", "PERM")).rejects.toHaveProperty("status", 503)
    })
})
