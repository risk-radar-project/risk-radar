import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { AxiosInstance } from "axios";

type UserResponse = { data?: { email?: string; contact?: { email?: string } } };
type GetFn = (path: string) => Promise<UserResponse>;

const getMock = jest.fn<GetFn>();

jest.mock("axios", () => {
    const instance: AxiosInstance = { get: getMock } as unknown as AxiosInstance;
    return {
        create: jest.fn(() => instance),
    };
});

jest.mock("../../src/config/config", () => ({
    config: {
        userServiceBaseUrl: "http://user-service"
    }
}));

const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

import { userServiceClient } from "../../src/clients/user-service-client";

describe("userServiceClient", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it("returns email on first attempt", async () => {
        getMock.mockResolvedValueOnce({ data: { email: "user@example.com" } });

        const email = await userServiceClient.getUserEmail("user-1");

        expect(email).toBe("user@example.com");
        expect(getMock).toHaveBeenCalledTimes(1);
    });

    it("retries before succeeding", async () => {
        getMock
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({ data: { email: "later@example.com" } });

        const email = await userServiceClient.getUserEmail("user-2");

        expect(email).toBe("later@example.com");
        expect(getMock).toHaveBeenCalledTimes(2);
    });

    it("returns null after exhausting attempts", async () => {
        getMock.mockRejectedValue(new Error("fatal"));

        const email = await userServiceClient.getUserEmail("user-3");

        expect(email).toBeNull();
        expect(getMock).toHaveBeenCalledTimes(3);
    });

    it("uses nested contact email when primary is missing", async () => {
        getMock.mockResolvedValueOnce({ data: { contact: { email: "fallback@example.com" } } });

        const email = await userServiceClient.getUserEmail("user-4");

        expect(email).toBe("fallback@example.com");
        expect(getMock).toHaveBeenCalledTimes(1);
    });

    it("returns null immediately when response lacks emails", async () => {
        getMock.mockResolvedValueOnce({ data: {} });

        const email = await userServiceClient.getUserEmail("user-5");

        expect(email).toBeNull();
        expect(getMock).toHaveBeenCalledTimes(1);
    });
});