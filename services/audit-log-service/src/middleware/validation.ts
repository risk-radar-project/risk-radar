import { Request, Response, NextFunction } from 'express';
import { ObjectSchema } from 'joi';
import { logger } from '../utils/logger';

export interface ValidationTargets {
    body?: ObjectSchema;
    query?: ObjectSchema;
    params?: ObjectSchema;
}

export function validateRequest(schemas: ValidationTargets) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const errors: string[] = [];

        if (schemas.body) {
            const { error } = schemas.body.validate(req.body);
            if (error) {
                errors.push(`Body: ${error.details.map(d => d.message).join(', ')}`);
            }
        }

        if (schemas.query) {
            const { error, value } = schemas.query.validate(req.query);
            if (error) {
                errors.push(`Query: ${error.details.map(d => d.message).join(', ')}`);
            } else {
                req.query = value;
            }
        }

        if (schemas.params) {
            const { error } = schemas.params.validate(req.params);
            if (error) {
                errors.push(`Params: ${error.details.map(d => d.message).join(', ')}`);
            }
        }

        if (errors.length > 0) {
            logger.warn('Validation failed', { errors, path: req.path, method: req.method });
            res.status(400).json({
                error: 'Validation failed',
                details: errors,
            });
            return;
        }

        next();
    };
}
