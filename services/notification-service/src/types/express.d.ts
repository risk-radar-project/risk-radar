import "express";

declare global {
    namespace Express {
        interface Request {
            context?: {
                userId?: string;
                userRole?: string;
            };
        }
    }
}

export {};
