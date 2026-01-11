import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import supertest from "supertest";

const mockInboxService = {
    list: jest.fn<(
        userId: string,
        page: number,
        limit: number,
        isRead?: boolean
    ) => Promise<{ data: unknown[]; total: number }>>(),
    markAsRead: jest.fn<(notificationId: string, userId: string) => Promise<boolean>>()
};
const mockNotificationDispatcher = {
    dispatch: jest.fn<(payload: unknown) => Promise<void>>()
};
const mockAuthzClient = {
    hasPermission: jest.fn<(userId: string, permission: string) => Promise<boolean>>().mockResolvedValue(true)
};

jest.mock("../../src/services/inbox-service", () => ({
    inboxService: mockInboxService
}));
jest.mock("../../src/services/notification-dispatcher", () => ({
    notificationDispatcher: mockNotificationDispatcher
}));
jest.mock("../../src/clients/authz-client", () => ({
    authzClient: mockAuthzClient
}));

import { createApp } from "../../src/app";

describe("notifications routes", () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockInboxService.list.mockResolvedValue({ data: [{ id: "n1" }], total: 1 });
        mockInboxService.markAsRead.mockResolvedValue(true);
        mockNotificationDispatcher.dispatch.mockResolvedValue(undefined);
        mockAuthzClient.hasPermission.mockResolvedValue(true);
        app = createApp();
    });

    it("rejects listing without X-User-ID", async () => {
        const res = await supertest(app).get("/notifications");
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Missing X-User-ID/);
    });

    it("returns paginated notifications when header present", async () => {
        const res = await supertest(app)
            .get("/notifications")
            .set("X-User-ID", "11111111-1111-4111-8111-111111111111");

        expect(res.status).toBe(200);
        expect(mockInboxService.list).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", 1, 20, undefined);
        expect(res.body).toEqual({
            data: [{ id: "n1" }],
            pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1
            }
        });
    });

    it("marks notification as read", async () => {
        const res = await supertest(app)
            .post("/notifications/22222222-3333-4333-9333-111111111111/read")
            .set("X-User-ID", "11111111-1111-4111-8111-111111111111");

        expect(res.status).toBe(204);
        expect(mockInboxService.markAsRead).toHaveBeenCalled();
    });

    it("validates fallback payload", async () => {
        const res = await supertest(app)
            .post("/notifications/send")
            .set("X-User-ID", "11111111-1111-4111-8111-111111111111")
            .send({ eventType: "USER_REGISTERED", userId: "bad-id" });

        expect(res.status).toBe(400);
        expect(res.body.details[0]).toContain("UUID");
    });

    it("dispatches fallback events", async () => {
        const payload = {
            eventType: "USER_REGISTERED",
            userId: "33333333-3333-4333-8333-333333333333",
            payload: { displayName: "QA" }
        };
        const res = await supertest(app)
            .post("/notifications/send")
            .set("X-User-ID", "11111111-1111-4111-8111-111111111111")
            .send(payload);

        expect(res.status).toBe(202);
        expect(mockNotificationDispatcher.dispatch).toHaveBeenCalledWith(expect.objectContaining(payload));
    });
});
