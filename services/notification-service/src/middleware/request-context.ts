import { NextFunction, Request, Response } from "express";

export function requestContext(req: Request, _res: Response, next: NextFunction): void {
    const userId = req.header("X-User-ID");
    const userRole = req.header("X-User-Role");
    const context: Request["context"] = {};
    if (userId) {
        context.userId = userId;
    }
    if (userRole) {
        context.userRole = userRole;
    }
    req.context = context;
    next();
}
