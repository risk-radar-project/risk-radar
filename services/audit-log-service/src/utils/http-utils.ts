import { Response } from 'express';
import { logger } from './logger';

export interface ErrorResponse {
    error: string;
    message: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SuccessResponse<T = any> {
    data: T;
}

export function writeJSON<T>(res: Response, status: number, data: T): void {
    res.status(status).json(data);
}

export function writeError(
    res: Response,
    status: number,
    message: string,
    error?: Error
): void {
    const errorResponse: ErrorResponse = {
        message,
        error: error?.message || message
    };

    if (error) {
        logger.error('HTTP Error', {
            status,
            message,
            error: error.message,
            stack: error.stack
        });
    }

    res.status(status).json(errorResponse);
}

export function writePaginated<T>(
    res: Response,
    data: T[],
    page: number,
    pageSize: number,
    total: number
): void {
    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
        data,
        pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    });
}
