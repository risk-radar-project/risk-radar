import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const queryMock = jest.fn<(...args: [string, unknown[]?]) => Promise<unknown>>();
const connectMock = jest.fn();
const onMock = jest.fn<(event: string, handler: (...args: unknown[]) => void) => void>();

jest.mock("pg", () => {
    return {
        Pool: jest.fn(() => ({
            query: queryMock,
            connect: connectMock,
            on: onMock
        }))
    };
});

jest.mock("../../src/config/config", () => ({
    config: {
        databaseUrl: "postgres://test",
        logDbQueries: false
    }
}));

import { database } from "../../src/database/database";

describe("database service", () => {
    beforeEach(() => {
        queryMock.mockReset();
        connectMock.mockReset();
        onMock.mockReset();
        (database as unknown as { connected: boolean }).connected = false;
    });

    it("waits for connection and marks as connected", async () => {
        queryMock.mockResolvedValue({ rows: [] });
        await database.waitForConnection();
        expect(queryMock).toHaveBeenCalledWith("SELECT 1");
    });

    it("retries failed connection attempts and eventually resolves", async () => {
        queryMock
            .mockRejectedValueOnce(new Error("first"))
            .mockResolvedValueOnce({ rows: [] });

        const promise = database.waitForConnection(2, 0);
        await promise;
        expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it("throws when exceeding retry count", async () => {
        queryMock.mockRejectedValue(new Error("boom"));
        await expect(database.waitForConnection(1, 0)).rejects.toThrow("Could not connect to database");
    });

    it("healthCheck returns false when query fails", async () => {
        queryMock.mockRejectedValue(new Error("fail"));
        (database as unknown as { connected: boolean }).connected = true;
        const healthy = await database.healthCheck();
        expect(healthy).toBe(false);
    });

    it("query propagates errors and resets connection state", async () => {
        const error = new Error("query failure");
        queryMock.mockRejectedValue(error);
        (database as unknown as { connected: boolean }).connected = true;
        await expect(database.query("SELECT 1")).rejects.toThrow("query failure");
        expect((database as unknown as { connected: boolean }).connected).toBe(false);
    });
});
