import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const queryMock = jest.fn() as jest.MockedFunction<(
    query: string,
    params?: unknown[]
) => Promise<{ rows: unknown[]; rowCount?: number }>>;

jest.mock("../../../src/database/database", () => ({
    database: {
        query: queryMock,
    }
}));

import { inboxRepository } from "../../../src/repositories/inbox-repository";

describe("inboxRepository", () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it("creates inbox entries and returns id", async () => {
        queryMock.mockResolvedValueOnce({ rows: [{ id: "notification-1" }] });

        const id = await inboxRepository.create({
            id: "notification-1",
            userId: "user-1",
            eventId: "evt-1",
            eventType: "USER_REGISTERED",
            title: "Hello",
            body: "Body",
            metadata: { foo: "bar" }
        });

        expect(id).toBe("notification-1");
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO notifications_inbox"),
            expect.arrayContaining([
                "notification-1",
                "user-1",
                "evt-1",
                "USER_REGISTERED",
                "Hello",
                "Body",
                { foo: "bar" }
            ])
        );
    });

    it("throws when insert does not return id", async () => {
        queryMock.mockResolvedValueOnce({ rows: [] });

        await expect(inboxRepository.create({
            id: "notification-2",
            userId: "user-1",
            eventId: "evt-1",
            eventType: "USER_REGISTERED",
            title: "Hello",
            body: "Body",
        })).rejects.toThrow("Failed to persist inbox notification");
    });

    it("lists notifications with optional read filter", async () => {
        const now = new Date();
        queryMock.mockResolvedValueOnce({
            rows: [
                {
                    id: "n1",
                    user_id: "user-1",
                    event_id: "evt-1",
                    event_type: "USER_REGISTERED",
                    title: "Hello",
                    body: "Body",
                    metadata: { foo: "bar" },
                    is_read: true,
                    read_at: now,
                    created_at: now,
                }
            ]
        });

        const notifications = await inboxRepository.listByUser("user-1", 10, 0, true);

        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("AND is_read = $"), ["user-1", true, 10, 0]);
        expect(notifications[0]).toEqual(expect.objectContaining({
            id: "n1",
            userId: "user-1",
            isRead: true,
            metadata: { foo: "bar" },
            readAt: now,
        }));
    });

    it("updates read states", async () => {
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        expect(await inboxRepository.markAsRead("n1", "user-1")).toBe(true);
        expect(await inboxRepository.markAsRead("n1", "user-1")).toBe(false);
        expect(await inboxRepository.markAsUnread("n1", "user-1")).toBe(true);
        expect(await inboxRepository.markAsUnread("n1", "user-1")).toBe(false);
    });

    it("counts notifications by user", async () => {
        queryMock.mockResolvedValueOnce({ rows: [{ count: 5 }] });
        const count = await inboxRepository.countByUser("user-1");
        expect(count).toBe(5);
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("SELECT COUNT(*)"),
            ["user-1"]
        );
    });

    it("counts notifications with filter", async () => {
        queryMock.mockResolvedValueOnce({ rows: [{ count: 2 }] });
        const count = await inboxRepository.countByUser("user-1", false);
        expect(count).toBe(2);
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("is_read = $"),
            ["user-1", false]
        );
    });
});
