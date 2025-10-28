process.env.HOSTNAME = "x"
process.env.AUTHZ_SERVICE_PORT = "8081"
process.env.AUDIT_LOG_SERVICE_PORT = "8082"

describe("logger", () => {
    const orig = { ...process.env }
    afterEach(() => {
        process.env = { ...orig }
        jest.resetModules()
    })

    it("adds file transports in production", async () => {
        process.env.NODE_ENV = "production"
        const { logger } = await import("../../../src/logger/logger.js")
        // Winston logger stores transports array
        expect((logger as any).transports.length).toBeGreaterThan(1)
    })
})
