import { Request, Response } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export function errorHandler(
    err: AppError,
    req: Request,
    res: Response,
): void {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    logger.error('Request error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        statusCode,
    });

    res.status(statusCode).json({
        error: message,
        message: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}

export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        error: 'Route not found',
        message: `Route ${req.method} ${req.path} not found`,
    });
}

export function createError(message: string, statusCode = 500): AppError {
    const error: AppError = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
}
