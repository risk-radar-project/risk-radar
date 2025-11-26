import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type AsyncVoid = () => Promise<void>;
type SendPayload = (payload: unknown) => Promise<void>;

const connectMock = jest.fn() as jest.MockedFunction<AsyncVoid>;
const sendMock = jest.fn() as jest.MockedFunction<SendPayload>;
const disconnectMock = jest.fn() as jest.MockedFunction<AsyncVoid>;
const producerFactory = jest.fn(() => ({
    connect: connectMock,
    send: sendMock,
    disconnect: disconnectMock,
}));

jest.mock("kafkajs", () => {
    return {
        Kafka: jest.fn(() => ({
            producer: producerFactory,
        })),
        logLevel: { NOTHING: 0 },
    };
});

const loggerMock = {
    info: jest.fn(),
    warn: jest.fn(),
};

const mockConfig = {
    auditKafka: {
        enabled: true,
        brokers: ["broker:9092"],
        topic: "audit_logs",
        clientId: "notification-service",
        acks: -1 as -1 | 0 | 1,
        connectionTimeoutMs: 1000,
        requestTimeoutMs: 1000,
        sendTimeoutMs: 1000,
        idempotent: true,
    }
};

jest.mock("../../../src/config/config", () => ({
    config: mockConfig,
}));

jest.mock("../../../src/utils/logger", () => ({
    logger: loggerMock,
}));

function loadModule(): typeof import("../../../src/audit/audit-kafka-producer") {
    let module: typeof import("../../../src/audit/audit-kafka-producer") | undefined;
    jest.isolateModules(() => {
        module = require("../../../src/audit/audit-kafka-producer");
    });
    return module!;
}

describe("audit-kafka-producer", () => {
    beforeEach(() => {
        jest.resetModules();
        connectMock.mockReset();
        sendMock.mockReset();
        disconnectMock.mockReset();
        producerFactory.mockClear();
        loggerMock.info.mockReset();
        loggerMock.warn.mockReset();
        mockConfig.auditKafka.enabled = true;
    });

    it("throws when Kafka is not configured", async () => {
        mockConfig.auditKafka.enabled = false;
        const { publishAuditLog } = loadModule();

        await expect(publishAuditLog({})).rejects.toThrow("Audit Kafka not configured");
        expect(connectMock).not.toHaveBeenCalled();
    });

    it("connects and sends payloads", async () => {
        const { publishAuditLog } = loadModule();
        connectMock.mockResolvedValue(undefined);
        sendMock.mockResolvedValue(undefined);

        await publishAuditLog({ operation_id: "evt-123", foo: "bar" });
        await publishAuditLog({ operation_id: "evt-456" });

        expect(connectMock).toHaveBeenCalledTimes(1);
        expect(sendMock).toHaveBeenCalledTimes(2);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            topic: "audit_logs",
            messages: [expect.objectContaining({ key: "evt-456" })]
        }));
        expect(loggerMock.info).toHaveBeenCalledWith(
            "Audit Kafka producer connected",
            expect.objectContaining({ topic: "audit_logs" })
        );
    });

    it("disconnects producer and logs warnings on failures", async () => {
        const { publishAuditLog, disconnectAuditProducer } = loadModule();
        connectMock.mockResolvedValue(undefined);
        sendMock.mockResolvedValue(undefined);
        disconnectMock.mockRejectedValue(new Error("boom"));

        await publishAuditLog({});
        await disconnectAuditProducer();

        expect(disconnectMock).toHaveBeenCalledTimes(1);
        expect(loggerMock.warn).toHaveBeenCalledWith(
            "Audit Kafka producer disconnect failed",
            expect.objectContaining({ error: "boom" })
        );
    });
});
