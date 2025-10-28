import { detectMime, isAllowedMime } from "../../../src/storage/magic"

jest.mock("file-type", () => ({ fileTypeFromBuffer: async (_buf: Buffer) => ({ mime: "image/png" }) }))

describe("magic", () => {
    test("detectMime returns mime", async () => {
        const { mime } = await detectMime(Buffer.from("test"))
        expect(mime).toBe("image/png")
    })
    test("isAllowedMime true for allowed", () => {
        expect(isAllowedMime("image/jpeg")).toBe(true)
        expect(isAllowedMime("image/png")).toBe(true)
    })
    test("isAllowedMime false for others", () => {
        expect(isAllowedMime(null)).toBe(false)
        expect(isAllowedMime("image/gif")).toBe(false)
    })
})
