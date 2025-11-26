import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const addMock = jest.fn();
let capturedFormatter: ((info: Record<string, unknown>) => string) | undefined;
const mockConsoleTransport = jest.fn();
const mockFileTransport = jest.fn();
const mockConfig = {
    logLevel: "info",
    nodeEnv: "development",
};

jest.mock("winston", () => {
    return {
        format: {
            combine: jest.fn((...args) => args),
            timestamp: jest.fn((options) => options),
            json: jest.fn(() => ({})),
            printf: jest.fn((formatter: (info: Record<string, unknown>) => string) => {
                capturedFormatter = formatter;
                return formatter;
            }),
        },
        transports: {
            Console: jest.fn().mockImplementation(function Console(this: unknown, options: unknown) {
                Object.assign(this as Record<string, unknown>, options);
                mockConsoleTransport(options);
            }),
            File: jest.fn().mockImplementation(function File(this: unknown, options: unknown) {
                Object.assign(this as Record<string, unknown>, options);
                mockFileTransport(options);
            }),
        },
        createLogger: jest.fn(() => ({ add: addMock })),
    };
});

jest.mock("../../../src/config/config", () => ({
    config: mockConfig,
}));

async function loadLogger(): Promise<typeof import("../../../src/utils/logger") extends { logger: infer Logger }
    ? Logger
    : never> {
    const module = await import("../../../src/utils/logger");
    return module.logger;
}

describe("logger", () => {
    beforeEach(() => {
        jest.resetModules();
        addMock.mockReset();
        mockConsoleTransport.mockReset();
        mockFileTransport.mockReset();
        capturedFormatter = undefined;
        mockConfig.logLevel = "info";
        mockConfig.nodeEnv = "development";
    });

    it("formats debug and info messages with colors", async () => {
        await loadLogger();

        const formatter = capturedFormatter;
        expect(formatter).toBeDefined();
        const debugLine = formatter!({ timestamp: "2025-11-26 10:00:00", level: "debug", message: "dbg", extra: 1 });
        const infoLine = formatter!({ timestamp: "2025-11-26 10:00:00", level: "info", message: "hello" });

        expect(debugLine).toContain("\x1b[90mdebug: dbg");
        expect(infoLine).toContain("\x1b[32minfo\x1b[0m: hello");
        expect(mockConsoleTransport).toHaveBeenCalled();
        expect(addMock).not.toHaveBeenCalled();
    });

    it("adds file transports in production", async () => {
        mockConfig.nodeEnv = "production";
        await loadLogger();

        expect(addMock).toHaveBeenCalledTimes(2);
        expect(mockFileTransport).toHaveBeenCalledTimes(2);
    });
});
