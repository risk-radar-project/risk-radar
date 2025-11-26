import { describe, expect, it, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../src/middleware/error-handler";

describe("errorHandler middleware", () => {
    it("logs and responds with 500", () => {
        const status = jest.fn().mockReturnThis();
        const json = jest.fn();
        const res = { status, json } as unknown as Response;
        const req = {} as Request;
        const next = jest.fn() as NextFunction;

        errorHandler(new Error("boom"), req, res, next);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({ error: "Internal server error" });
        expect(next).not.toHaveBeenCalled();
    });
});
