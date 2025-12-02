import { describe, expect, it, jest } from "@jest/globals";
import type { Response } from "express";

const dbHealthCheckMock = jest.fn<() => Promise<boolean>>();
const kafkaHealthMock = jest.fn<() => Promise<"up" | "down" | "disabled">>();
const smtpHealthMock = jest.fn<() => Promise<"up" | "down" | "disabled">>();
const kafkaRuntimeMock = jest.fn(() => ({
    mode: "connected" as const,
    connected: true,
    reconnecting: false,
    brokersConfigured: true,
    lastError: null,
    lastFailureAt: null
}));

jest.mock("../../src/database/database", () => ({
    database: {
        healthCheck: dbHealthCheckMock
    }
}));

jest.mock("../../src/config/config", () => ({
    config: {
        kafkaBrokers: ["broker-1"],
        smtpHost: "mailpit"
    }
}));

jest.mock("../../src/services/health-checks", () => ({
    checkKafkaHealth: kafkaHealthMock,
    checkSmtpHealth: smtpHealthMock,
}));

jest.mock("../../src/services/notification-consumer", () => ({
    notificationConsumer: {
        getRuntimeStatus: kafkaRuntimeMock
    }
}));

import { getStatus } from "../../src/controllers/status-controller";

function createResponse(): { res: Response; json: jest.Mock } {
    const json = jest.fn();
    const res = { json } as unknown as Response;
    return { res, json };
}

describe("getStatus controller", () => {
    it("reports ok when dependencies healthy", async () => {
        dbHealthCheckMock.mockResolvedValue(true);
        kafkaHealthMock.mockResolvedValue("up");
        smtpHealthMock.mockResolvedValue("up");
        const { res, json } = createResponse();

        await getStatus({} as never, res);

        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            status: "ok",
            services: expect.objectContaining({
                database: "up",
                kafka: expect.objectContaining({ status: "up", mode: "connected" }),
                smtp: "up"
            })
        }));
    });

    it("reports degraded when database fails", async () => {
        dbHealthCheckMock.mockResolvedValue(false);
        kafkaHealthMock.mockResolvedValue("up");
        smtpHealthMock.mockResolvedValue("up");
        const { res, json } = createResponse();

        await getStatus({} as never, res);

        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            status: "degraded",
            services: expect.objectContaining({ database: "down" })
        }));
    });
});
