import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { Request, Response } from "express";

const mockListNotifications = jest.fn<(userId: string,
    page: number,
    limit: number,
    isRead?: boolean
) => Promise<unknown[]>>();
const mockMarkAsRead = jest.fn<(id: string, userId: string) => Promise<boolean>>();
const mockMarkAsUnread = jest.fn<(id: string, userId: string) => Promise<boolean>>();

jest.mock("../../src/services/inbox-service", () => ({
    inboxService: {
        list: mockListNotifications,
        markAsRead: mockMarkAsRead,
        markAsUnread: mockMarkAsUnread,
    }
}));

const mockRecordUserAction = jest.fn() as jest.MockedFunction<(payload: unknown) => Promise<void>>;
mockRecordUserAction.mockResolvedValue(undefined);

jest.mock("../../src/clients/audit-client", () => ({
    auditClient: {
        recordUserAction: mockRecordUserAction
    }
}));

import { listNotifications, markAsRead, markAsUnread } from "../../src/controllers/notifications-controller";

function createRequest(options: {
    userId?: string;
    notificationId?: string;
    page?: string;
    limit?: string;
    isRead?: string;
} = {}): Request {
    return {
        context: { userId: options.userId ?? "" },
        params: options.notificationId ? { id: options.notificationId } : {},
        query: {
            ...(options.page ? { page: options.page } : {}),
            ...(options.limit ? { limit: options.limit } : {}),
            ...(options.isRead ? { isRead: options.isRead } : {}),
        }
    } as unknown as Request;
}

function createResponse(): Response {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn()
    };
    return res as unknown as Response;
}

describe("notifications controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockListNotifications.mockResolvedValue([]);
        mockRecordUserAction.mockResolvedValue(undefined);
    });

    describe("listNotifications", () => {
        it("rejects missing user id", async () => {
            const req = createRequest({ page: "1", limit: "10" });
            const res = createResponse();

            await listNotifications(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Missing X-User-ID header" });
            expect(mockListNotifications).not.toHaveBeenCalled();
            expect(mockRecordUserAction).not.toHaveBeenCalled();
        });

        it("returns notifications and records audit", async () => {
            const req = createRequest({ userId: "user-1", page: "2", limit: "5", isRead: "true" });
            const res = createResponse();
            mockListNotifications.mockResolvedValue([{ id: "n1" }]);

            await listNotifications(req, res);

            expect(mockListNotifications).toHaveBeenCalledWith("user-1", 2, 5, true);
            expect(res.json).toHaveBeenCalledWith({ data: [{ id: "n1" }] });
            expect(mockRecordUserAction).toHaveBeenCalledWith({
                action: "notifications.inbox.list",
                actorId: "user-1",
                metadata: { page: 2, limit: 5, isRead: true }
            });
        });
    });

    describe("markAsRead", () => {
        it("rejects missing user header", async () => {
            const req = createRequest({ notificationId: "id-1" });
            const res = createResponse();

            await markAsRead(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Missing X-User-ID header" });
            expect(mockMarkAsRead).not.toHaveBeenCalled();
            expect(mockRecordUserAction).not.toHaveBeenCalled();
        });

        it("rejects missing notification id", async () => {
            const req = createRequest({ userId: "user-1" });
            const res = createResponse();

            await markAsRead(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Missing notification id" });
            expect(mockMarkAsRead).not.toHaveBeenCalled();
            expect(mockRecordUserAction).not.toHaveBeenCalled();
        });

        it("returns 404 when notification not found", async () => {
            mockMarkAsRead.mockResolvedValue(false);
            const req = createRequest({ userId: "user-1", notificationId: "id-2" });
            const res = createResponse();

            await markAsRead(req, res);

            expect(mockMarkAsRead).toHaveBeenCalledWith("id-2", "user-1");
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: "Notification not found" });
            expect(mockRecordUserAction).not.toHaveBeenCalled();
        });

        it("returns 204 when notification marked as read", async () => {
            mockMarkAsRead.mockResolvedValue(true);
            const req = createRequest({ userId: "user-1", notificationId: "id-3" });
            const res = createResponse();

            await markAsRead(req, res);

            expect(mockMarkAsRead).toHaveBeenCalledWith("id-3", "user-1");
            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.send).toHaveBeenCalled();
            expect(mockRecordUserAction).toHaveBeenCalledWith({
                action: "notifications.inbox.mark_read",
                actorId: "user-1",
                targetId: "id-3",
                metadata: { previousState: "unread", newState: "read" }
            });
        });
    });

    describe("markAsUnread", () => {
        it("rejects missing user header", async () => {
            const req = createRequest({ notificationId: "id-4" });
            const res = createResponse();

            await markAsUnread(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Missing X-User-ID header" });
            expect(mockMarkAsUnread).not.toHaveBeenCalled();
            expect(mockRecordUserAction).not.toHaveBeenCalled();
        });

        it("rejects missing notification id", async () => {
            const req = createRequest({ userId: "user-2" });
            const res = createResponse();

            await markAsUnread(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Missing notification id" });
            expect(mockMarkAsUnread).not.toHaveBeenCalled();
            expect(mockRecordUserAction).not.toHaveBeenCalled();
        });

        it("returns 404 when unread action fails", async () => {
            mockMarkAsUnread.mockResolvedValue(false);
            const req = createRequest({ userId: "user-2", notificationId: "id-5" });
            const res = createResponse();

            await markAsUnread(req, res);

            expect(mockMarkAsUnread).toHaveBeenCalledWith("id-5", "user-2");
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: "Notification not found" });
            expect(mockRecordUserAction).not.toHaveBeenCalled();
        });

        it("returns 204 when marked as unread", async () => {
            mockMarkAsUnread.mockResolvedValue(true);
            const req = createRequest({ userId: "user-2", notificationId: "id-6" });
            const res = createResponse();

            await markAsUnread(req, res);

            expect(mockMarkAsUnread).toHaveBeenCalledWith("id-6", "user-2");
            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.send).toHaveBeenCalled();
            expect(mockRecordUserAction).toHaveBeenCalledWith({
                action: "notifications.inbox.mark_unread",
                actorId: "user-2",
                targetId: "id-6",
                metadata: { previousState: "read", newState: "unread" }
            });
        });
    });
});