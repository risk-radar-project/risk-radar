process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db"
const startMock = jest.fn(async () => { })
const stopMock = jest.fn(async () => { })
const mediaServerInstance = { start: startMock, stop: stopMock }

const MediaServerMock = jest.fn(() => mediaServerInstance)

jest.mock("../../../src/media-server.js", () => ({ __esModule: true, default: MediaServerMock }))
jest.mock("../../../src/logger/logger.js", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}))

describe("server bootstrap", () => {
    beforeEach(() => {
        jest.resetModules()
        MediaServerMock.mockClear()
        startMock.mockClear()
    })

    it("instantiates media server and starts it on import", async () => {
        await import("../../../src/server.js")
        expect(MediaServerMock).toHaveBeenCalledTimes(1)
        expect(startMock).toHaveBeenCalledTimes(1)
    })
})
