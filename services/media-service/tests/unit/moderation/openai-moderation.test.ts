process.env.HOSTNAME = "authz.local"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"

import axios from "axios"
import { moderateImage } from "../../../src/moderation/openai-moderation"
import { config } from "../../../src/config/config"

jest.mock("axios")

describe("moderateImage", () => {
    const buf = Buffer.from("fake")

    beforeAll(() => {
        ;(config as any).moderation.enabled = true
        ;(config as any).moderation.apiKey = "k"
    })

    test("returns flagged=false when API success and result not flagged", async () => {
        ;(axios.post as any).mockResolvedValueOnce({ data: { results: [{ flagged: false }] } })
        const r = await moderateImage(buf)
        expect(r.flagged).toBe(false)
        expect(r.elapsedMs).toBeGreaterThanOrEqual(0)
    })

    test("fail-closed sets flagged=true on error", async () => {
        ;(axios.post as any).mockRejectedValueOnce(new Error("network"))
        const r = await moderateImage(buf)
        expect(r.flagged).toBe(true)
    })
})
