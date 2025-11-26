import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { logLevel } from "kafkajs";

const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

const mockConfig = {
    logKafkaEvents: false,
};

jest.mock("../../../src/utils/logger", () => ({
    logger: mockLogger,
}));

jest.mock("../../../src/config/config", () => ({
    config: mockConfig,
}));

describe("kafkaLogCreator", () => {
    beforeEach(() => {
        jest.resetModules();
        mockLogger.error.mockReset();
        mockLogger.warn.mockReset();
        mockLogger.info.mockReset();
        mockLogger.debug.mockReset();
        mockConfig.logKafkaEvents = false;
    });

    it("suppresses info/debug when kafka logging disabled", async () => {
        const module = await import("../../../src/utils/kafka-logger");
        const kafkaLogger = module.kafkaLogCreator();

        kafkaLogger({ level: logLevel.INFO, log: { message: "info" } });
        kafkaLogger({ level: logLevel.ERROR, log: { message: "boom" } });

        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith("boom", {});
    });

    it("forwards info logs when enabled", async () => {
        mockConfig.logKafkaEvents = true;
        const module = await import("../../../src/utils/kafka-logger");
        const kafkaLogger = module.kafkaLogCreator();

        kafkaLogger({ level: logLevel.INFO, namespace: "consumer", log: { message: "info", partition: 1 } });

        expect(mockLogger.info).toHaveBeenCalledWith("info", { namespace: "consumer", partition: 1 });
    });

    it("maps unknown levels to info", async () => {
        mockConfig.logKafkaEvents = true;
        const module = await import("../../../src/utils/kafka-logger");
        const kafkaLogger = module.kafkaLogCreator();

        kafkaLogger({ level: 999, log: { message: "mystery" } });

        expect(mockLogger.info).toHaveBeenCalledWith("mystery", {});
    });
});
