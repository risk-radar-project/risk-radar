import Joi from 'joi';

export const createLogSchema = Joi.object({
    timestamp: Joi.string().isoDate().optional(),
    service: Joi.string().min(1).max(255).required(),
    action: Joi.string().min(1).max(255).required(),
    actor: Joi.object({
        id: Joi.string().min(1).max(255).required(),
        type: Joi.string().valid('user', 'admin', 'system', 'service', 'unknown').required(),
        // Accept any string to avoid rejecting proxied/forwarded values.
        ip: Joi.string().min(1).max(255).optional(),
    }).required(),
    target: Joi.object({
        id: Joi.string().min(1).max(255).optional(),
        type: Joi.string().min(1).max(255).optional(),
    }).optional(),
    status: Joi.string().valid('success', 'failure', 'warning', 'error').required(),
    operation_id: Joi.string().min(1).max(255).optional().allow(null),
    log_type: Joi.string().valid('ACTION', 'SECURITY', 'SYSTEM', 'ERROR', 'INFO').required(),
    metadata: Joi.object().optional(),
    is_anonymized: Joi.boolean().optional().default(false),
});

export const getLogsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(1000).optional().default(50),
    service: Joi.string().min(1).max(255).optional(),
    action: Joi.string().min(1).max(255).optional(),
    actor_id: Joi.string().min(1).max(255).optional(),
    target_id: Joi.string().min(1).max(255).optional(),
    status: Joi.string().valid('success', 'failure', 'warning', 'error').optional(),
    log_type: Joi.string().valid('ACTION', 'SECURITY', 'SYSTEM', 'ERROR', 'INFO').optional(),
    start_date: Joi.string().isoDate().optional(),
    end_date: Joi.string().isoDate().optional(),
    sort_by: Joi.string().valid('timestamp', 'service', 'action', 'actor', 'status', 'log_type').optional().default('timestamp'),
    order: Joi.string().valid('asc', 'desc').optional().default('desc'),
});

export const getLogByIdSchema = Joi.object({
    id: Joi.string().uuid().required(),
});

export const anonymizeLogsSchema = Joi.object({
    actor_id: Joi.string().min(1).max(255).required(),
});

export const anonymizeQuerySchema = Joi.object({
    dry_run: Joi.string().valid('true', 'false').optional(),
});

export const loginHistoryQuerySchema = Joi.object({
    actor_id: Joi.string().min(1).max(255).required(),
    limit: Joi.number().integer().min(1).max(100).optional().default(10),
});
