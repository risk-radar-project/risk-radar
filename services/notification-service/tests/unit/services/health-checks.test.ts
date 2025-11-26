import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const adminConnectMock = jest.fn() as jest.MockedFunction<() => Promise<void>>;
const adminDescribeMock = jest.fn() as jest.MockedFunction<() => Promise<void>>;
const adminDisconnectMock = jest.fn() as jest.MockedFunction<() => Promise<void>>;

jest.mock("kafkajs", () => ({
    Kafka: jest.fn(() => ({
        admin: (): Record<string, unknown> => ({
            connect: adminConnectMock,
            describeCluster: adminDescribeMock,
            disconnect: adminDisconnectMock,
        })
    })),
    logLevel: { NOTHING: 0 },
}));

const verifyConnectionMock = jest.fn() as jest.MockedFunction<() => Promise<boolean>>;

jest.mock("../../../src/services/email-delivery", () => ({
    emailDeliveryService: {
        verifyConnection: verifyConnectionMock,
    }
}));

const loggerMock = {
    error: jest.fn(),
    warn: jest.fn(),
};

const mockConfig = {
    kafkaBrokers: ["broker:9092"],
    kafkaClientId: "notification-service",
    smtpHost: "mailpit",
};

jest.mock("../../../src/config/config", () => ({
    config: mockConfig,
}));

jest.mock("../../../src/utils/logger", () => ({
    logger: loggerMock,
}));

import { checkKafkaHealth, checkSmtpHealth } from "../../../src/services/health-checks";

describe("health-checks", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockConfig.kafkaBrokers = ["broker:9092"];
        mockConfig.smtpHost = "mailpit";
    });

    describe("checkKafkaHealth", () => {
        it("returns disabled when brokers are missing", async () => {
            mockConfig.kafkaBrokers = [];

            const status = await checkKafkaHealth();

            expect(status).toBe("disabled");
            expect(adminConnectMock).not.toHaveBeenCalled();
        });

        it("returns up when cluster is reachable", async () => {
            adminConnectMock.mockResolvedValue(undefined);
            adminDescribeMock.mockResolvedValue(undefined);
            adminDisconnectMock.mockResolvedValue(undefined);

            const status = await checkKafkaHealth();

            expect(status).toBe("up");
            expect(adminConnectMock).toHaveBeenCalled();
            expect(adminDisconnectMock).toHaveBeenCalled();
        });

        it("returns down and logs errors on failures", async () => {
            adminConnectMock.mockResolvedValue(undefined);
            adminDescribeMock.mockRejectedValue(new Error("offline"));
            adminDisconnectMock.mockRejectedValue(new Error("close fail"));

            const status = await checkKafkaHealth();

            expect(status).toBe("down");
            expect(loggerMock.error).toHaveBeenCalledWith("Kafka health check failed", { error: "offline" });
            expect(loggerMock.warn).toHaveBeenCalledWith(
                "Kafka health check disconnect failed",
                { error: "close fail" }
            );
        });
    });

    describe("checkSmtpHealth", () => {
        it("returns disabled when SMTP host missing", async () => {
            mockConfig.smtpHost = "";

            const status = await checkSmtpHealth();

            expect(status).toBe("disabled");
        });

        it("reflects SMTP verify result", async () => {
            verifyConnectionMock.mockResolvedValueOnce(true);
            verifyConnectionMock.mockResolvedValueOnce(false);

            expect(await checkSmtpHealth()).toBe("up");
            expect(await checkSmtpHealth()).toBe("down");
        });

        it("logs and returns down when verify throws", async () => {
            verifyConnectionMock.mockRejectedValue(new Error("smtp down"));

            const status = await checkSmtpHealth();

            expect(status).toBe("down");
            expect(loggerMock.error).toHaveBeenCalledWith("SMTP health check failed", { error: "smtp down" });
        });
    });
});
