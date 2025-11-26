import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { AxiosInstance } from "axios";

type AxiosPostFn = (url: string, body: unknown, config?: { timeout?: number }) => Promise<void>;
type AxiosCreateFn = () => AxiosInstance;

jest.mock("axios", () => {
    const post = jest.fn<AxiosPostFn>();
    post.mockResolvedValue(undefined);
    const instance: AxiosInstance = { post } as unknown as AxiosInstance;
    const create = jest.fn<AxiosCreateFn>(() => instance);
    return {
        create,
        __instance: instance,
        __post: post,
    };
});

const axiosMock = jest.requireMock("axios") as {
    create: jest.MockedFunction<AxiosCreateFn>;
    __instance: AxiosInstance;
    __post: jest.MockedFunction<AxiosPostFn>;
};

jest.mock("../../src/audit/audit-kafka-producer", () => ({
    publishAuditLog: jest.fn(),
}));

import { auditClient } from "../../src/clients/audit-client";
import { config } from "../../src/config/config";
import { publishAuditLog } from "../../src/audit/audit-kafka-producer";

const payload = {
    eventId: "evt-1",
    channel: "email",
    status: "queued" as const,
    userId: "user-1",
    metadata: { foo: "bar" },
};

function lastAuditBody(): Record<string, unknown> {
    const body = (publishAuditLog as jest.Mock).mock.calls.at(-1)?.[0];
    if (!body) {
        throw new Error("No audit log body captured");
    }
    return body as Record<string, unknown>;
}

describe("AuditClient", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        config.auditKafka.enabled = true;
        config.auditKafka.brokers = ["kafka:9092"];
        config.auditHttpRetries = 1;
        config.auditHttpTimeoutMs = 10;
    });

    it("publishes via Kafka when enabled", async () => {
        await auditClient.recordNotification(payload);

        expect(publishAuditLog).toHaveBeenCalledTimes(1);
        expect(publishAuditLog).toHaveBeenCalledWith(expect.objectContaining({
            operation_id: payload.eventId,
        }));
        expect(axiosMock.__post).not.toHaveBeenCalled();
    });

    it("falls back to HTTP when Kafka publish fails", async () => {
        const publishAuditLogMock = publishAuditLog as jest.MockedFunction<typeof publishAuditLog>;
        publishAuditLogMock.mockRejectedValueOnce(new Error("offline"));
        axiosMock.__post.mockResolvedValueOnce(undefined);

        await auditClient.recordNotification(payload);

        expect(publishAuditLog).toHaveBeenCalled();
        expect(axiosMock.__post).toHaveBeenCalledTimes(1);
        const body = axiosMock.__post.mock.calls[0]?.[1];
        expect(body).toMatchObject({
            action: "notification.email.queued",
        });
    });

    it("retries HTTP according to configuration", async () => {
        config.auditKafka.enabled = false;
        config.auditHttpRetries = 2;
        axiosMock.__post.mockRejectedValue(new Error("http down"));

        await auditClient.recordNotification(payload);

        expect(axiosMock.__post).toHaveBeenCalledTimes(3);
    });

    it("records service actor metadata when userId is missing", async () => {
        await auditClient.recordNotification({
            eventId: "evt-2",
            channel: "email",
            status: "failed",
            metadata: { reason: "test" },
        });

        const body = lastAuditBody() as {
            actor: { id: string; type: string };
            log_type: string;
            target?: unknown;
            metadata: Record<string, unknown>;
        };
        expect(body).toMatchObject({
            actor: { id: "notification-service", type: "service" },
            log_type: "ERROR",
            metadata: { reason: "test" },
        });
        expect(body.target).toBeUndefined();
    });

    it("records user actions with default success status", async () => {
        await auditClient.recordUserAction({
            action: "notification.viewed",
            actorId: "user-42",
            metadata: { origin: "ui" },
        });

        const body = lastAuditBody() as { target?: unknown };
        expect(body).toMatchObject({
            action: "notification.viewed",
            log_type: "ACTION",
            status: "success",
            metadata: { origin: "ui" },
        });
        expect(body.target).toBeUndefined();
    });

    it("includes target info for user actions with explicit error status", async () => {
        await auditClient.recordUserAction({
            action: "notification.delete",
            actorId: "user-99",
            targetId: "notif-7",
            targetType: "inbox",
            status: "error",
            operationId: "op-7",
        });

        const body = lastAuditBody();
        expect(body).toMatchObject({
            action: "notification.delete",
            log_type: "ERROR",
            operation_id: "op-7",
            target: { id: "notif-7", type: "inbox" },
        });
    });
});
