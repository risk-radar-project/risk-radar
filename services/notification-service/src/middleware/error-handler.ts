import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
    void _next;
    logger.error("Unhandled error", {
        error: error instanceof Error ? error.message : "unknown error"
    });
    res.status(500).json({ error: "Internal server error" });
}
