import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type DatabaseInstance = typeof import("../../../src/database/database") extends { database: infer Database }
    ? Database
    : never;

const queryMock = jest.fn() as jest.MockedFunction<(
    text: string,
    params?: unknown[]
) => Promise<{ rows: unknown[] }>>;
const connectMock = jest.fn() as jest.MockedFunction<() => Promise<{ release: () => void }>>;
const loggerMock = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
const listeners: Record<string, ((payload?: unknown) => void)[]> = {};

const mockConfig = {
    databaseUrl: "postgres://notification-service@localhost:5432/notification",
    logDbQueries: false,
};

jest.mock("pg", () => {
    return {
        Pool: jest.fn().mockImplementation(() => ({
            query: queryMock,
            connect: connectMock,
            on: (event: string, handler: (payload?: unknown) => void): void => {
                if (!listeners[event]) {
                    listeners[event] = [];
                }
                listeners[event]!.push(handler);
            },
        })),
    };
});

jest.mock("../../../src/config/config", () => ({
    config: mockConfig,
}));

jest.mock("../../../src/utils/logger", () => ({
    logger: loggerMock,
}));

function resetState(): void {
    queryMock.mockReset();
    connectMock.mockReset();
    loggerMock.debug.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    Object.keys(listeners).forEach((event) => {
        listeners[event] = [];
    });
}

async function loadDatabase(): Promise<DatabaseInstance> {
    const module = await import("../../../src/database/database");
    return module.database;
}

describe("database", () => {
    beforeEach(() => {
        jest.resetModules();
        resetState();
        connectMock.mockResolvedValue({ release: jest.fn() });
        mockConfig.logDbQueries = false;
    });

    it("waits for connection and caches the state", async () => {
        queryMock.mockResolvedValueOnce({ rows: [] });
        const database = await loadDatabase();

        await database.waitForConnection();
        await database.waitForConnection();

        expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("retries failed connection attempts", async () => {
        queryMock
            .mockRejectedValueOnce(new Error("db down"))
            .mockResolvedValue({ rows: [] });
        const database = await loadDatabase();

        await database.waitForConnection(3, 0);

        expect(queryMock).toHaveBeenCalledTimes(2);
        expect(loggerMock.warn).toHaveBeenCalledWith("Database connection attempt failed", expect.any(Object));
    });

    it("logs queries when enabled", async () => {
        mockConfig.logDbQueries = true;
        queryMock.mockResolvedValue({ rows: [] });
        const database = await loadDatabase();

        await database.query("SELECT 1");

        expect(loggerMock.debug).toHaveBeenCalledWith("DB query executed", { text: "SELECT 1" });
    });

    it("emits errors and resets connection state", async () => {
        queryMock.mockResolvedValue({ rows: [] });
        const database = await loadDatabase();

        await database.waitForConnection();
        listeners.error?.forEach((handler) => handler(new Error("boom")));
        queryMock.mockResolvedValue({ rows: [] });

        await database.waitForConnection();

        expect(queryMock).toHaveBeenCalledTimes(2);
        expect(loggerMock.error).toHaveBeenCalledWith("Unexpected database error", { error: "boom" });
    });

    it("reports health check failures", async () => {
        const database = await loadDatabase();
        const querySpy = jest.spyOn(database, "query");
        querySpy.mockRejectedValueOnce(new Error("unreachable"));

        const healthy = await database.healthCheck();

        expect(healthy).toBe(false);
        expect(loggerMock.error).toHaveBeenCalledWith("Database health check failed", { error: expect.any(Error) });
    });

    it("returns db client after ensuring connectivity", async () => {
        queryMock.mockResolvedValue({ rows: [] });
        const client = { release: jest.fn() };
        connectMock.mockResolvedValue(client);
        const database = await loadDatabase();

        const pgClient = await database.getClient();

        expect(queryMock).toHaveBeenCalled();
        expect(connectMock).toHaveBeenCalled();
        expect(pgClient).toBe(client);
    });

    it("logs successful connection on pool connect event", async () => {
        queryMock.mockResolvedValue({ rows: [] });
        const database = await loadDatabase();

        listeners.connect?.forEach((handler) => handler());

        expect(loggerMock.debug).toHaveBeenCalledWith("Notification DB connection established");
        await database.waitForConnection();
        await database.waitForConnection();
        expect(queryMock).not.toHaveBeenCalled();
    });

    it("passes health checks when queries succeed", async () => {
        const database = await loadDatabase();
        const querySpy = jest.spyOn(database, "query");
        querySpy.mockResolvedValueOnce({} as never);

        const healthy = await database.healthCheck();

        expect(healthy).toBe(true);
        expect(loggerMock.error).not.toHaveBeenCalledWith("Database health check failed", expect.anything());
    });

    it("fails after exhausting connection retries", async () => {
        queryMock.mockRejectedValue(new Error("offline"));
        const database = await loadDatabase();

        await expect(database.waitForConnection(2, 0)).rejects.toThrow("Could not connect to database");
    });

    it("ignores connect events once already connected", async () => {
        queryMock.mockResolvedValue({ rows: [] });
        const database = await loadDatabase();

        await database.waitForConnection();
        loggerMock.debug.mockClear();

        listeners.connect?.forEach((handler) => handler());

        expect(loggerMock.debug).not.toHaveBeenCalledWith("Notification DB connection established");
    });

    it("reuses existing connection for clients", async () => {
        queryMock.mockResolvedValue({ rows: [] });
        const database = await loadDatabase();

        await database.waitForConnection();
        queryMock.mockClear();

        await database.getClient();

        expect(queryMock).not.toHaveBeenCalled();
        expect(connectMock).toHaveBeenCalled();
    });

    it("executes queries without rechecking connection state", async () => {
        queryMock.mockResolvedValue({ rows: [] });
        const database = await loadDatabase();

        await database.waitForConnection();
        queryMock.mockClear();

        await database.query("SELECT 42");

        expect(queryMock).toHaveBeenCalledTimes(1);
    });
});
