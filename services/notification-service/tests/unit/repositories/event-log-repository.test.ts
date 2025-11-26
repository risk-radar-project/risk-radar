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

import { eventLogRepository } from "../../../src/repositories/event-log-repository";

describe("eventLogRepository", () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it("checks whether events were processed", async () => {
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        queryMock.mockResolvedValueOnce({ rows: [{ event_id: "evt-1" }], rowCount: 1 });

        expect(await eventLogRepository.isProcessed("evt-1")).toBe(false);
        expect(await eventLogRepository.isProcessed("evt-1")).toBe(true);
        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("SELECT event_id"), ["evt-1"]);
    });

    it("marks events as processed", async () => {
        queryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await eventLogRepository.markProcessed("evt-2", "USER_REGISTERED");

        expect(queryMock)
            .toHaveBeenCalledWith(expect.stringContaining("INSERT INTO event_dispatch_log"), ["evt-2", "USER_REGISTERED"]);
    });
});
