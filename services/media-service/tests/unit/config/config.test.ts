describe("config", () => {
    const orig = { ...process.env }
    afterEach(() => {
        process.env = { ...orig }
        jest.resetModules()
    })

    it("reads base urls from HOSTNAME + ports", async () => {
        delete process.env.HOSTNAME
        delete process.env.AUTHZ_SERVICE_PORT
        delete process.env.AUDIT_LOG_SERVICE_PORT
        process.env.NODE_ENV = "production"
        process.env.HOSTNAME = "example-host"
        process.env.AUTHZ_SERVICE_PORT = "5001"
        process.env.AUDIT_LOG_SERVICE_PORT = "5002"
        const { config } = await import("../../../src/config/config.js")
        expect(config.authz.baseUrl).toBe("http://example-host:5001")
        expect(config.audit.baseUrl).toBe("http://example-host:5002")
    })

    it("parses numeric and boolean overrides", async () => {
        process.env.HOSTNAME = "a"
        process.env.AUTHZ_SERVICE_PORT = "1234"
        process.env.AUDIT_LOG_SERVICE_PORT = "2345"
        process.env.GC_ENABLED = "false"
        process.env.MAX_FILE_BYTES = "123"
        const { config } = await import("../../../src/config/config.js")
        expect(config.gc.enabled).toBe(false)
        expect(config.limits.maxBytes).toBe(123)
    })

    it("prefers AUDIT_BASE_URL when provided", async () => {
        process.env.HOSTNAME = "fallback-host"
        process.env.AUDIT_LOG_SERVICE_PORT = "9999"
        process.env.AUDIT_BASE_URL = "http://audit-log-service:8080"
        const { config } = await import("../../../src/config/config.js")
        expect(config.audit.baseUrl).toBe("http://audit-log-service:8080")
    })
})
