import { describe, expect, it, jest } from "@jest/globals";
import type { Response } from "express";

const dbHealthCheckMock = jest.fn<() => Promise<boolean>>();
const kafkaHealthMock = jest.fn<() => Promise<"up" | "down" | "disabled">>();
const smtpHealthMock = jest.fn<() => Promise<"up" | "down" | "disabled">>();

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
            services: expect.objectContaining({ database: "up", kafka: "up", smtp: "up" })
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
