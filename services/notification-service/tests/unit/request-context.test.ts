import { describe, expect, it, jest } from "@jest/globals";
import { requestContext } from "../../src/middleware/request-context";
import type { Request, Response, NextFunction } from "express";

describe("requestContext middleware", () => {
    it("injects user headers into request context", () => {
        const req = {
            header: (name: string) => ({ "X-User-ID": "abc", "X-User-Role": "admin" }[name] ?? undefined)
        } as unknown as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;

        requestContext(req, res, next);

        expect(req.context?.userId).toBe("abc");
        expect(req.context?.userRole).toBe("admin");
        expect(next).toHaveBeenCalled();
    });
});
