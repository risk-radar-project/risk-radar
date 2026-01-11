/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from 'express';
import { writePaginated } from '../utils/http-utils';
import { auditLogService } from '../services/audit-log-service';
import { getWebSocketHandler } from '../websocket/websocket-handler';
import { LoginHistoryQuery } from '../types';
import { authzClient } from '../clients/authz-client';

// Create Audit Log
export async function createLog(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { created, log } = await auditLogService.createLog(req.body);

        if (created) {
            res.status(201).json(log);
            const ws = getWebSocketHandler();
            if (ws) {
                ws.broadcastNewLog(log);
            }
        } else {
            // Idempotent call, no content
            res.status(204).end();
        }
    } catch (err) {
        next(err);
    }
}

// Get Audit Logs with filters and pagination
export async function getLogs(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Missing user ID' });
            return;
        }

        const allowed = await authzClient.hasPermission(userId, 'audit:view');
        if (!allowed) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        const filters = {
            ...(req.query.service ? { service: String(req.query.service) } : {}),
            ...(req.query.action ? { action: String(req.query.action) } : {}),
            ...(req.query.actor_id ? { actor_id: String(req.query.actor_id) } : {}),
            ...(req.query.target_id ? { target_id: String(req.query.target_id) } : {}),
            ...(req.query.status ? { status: req.query.status as any } : {}),
            ...(req.query.log_type ? { log_type: req.query.log_type as any } : {}),
            ...(req.query.start_date ? { start_date: String(req.query.start_date) } : {}),
            ...(req.query.end_date ? { end_date: String(req.query.end_date) } : {}),
            ...(req.query.sort_by ? { sort_by: String(req.query.sort_by) } : {}),
            ...(req.query.order ? { order: String(req.query.order) } : {}),
        };

        const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

        const result = await auditLogService.getLogs(filters, { page, limit });

        writePaginated(
            res,
            result.data,
            result.pagination.page,
            result.pagination.pageSize,
            result.pagination.total,
        );
    } catch (err) {
        next(err);
    }
}

// Get a single Audit Log by ID
export async function getLogById(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const id = String(req.params?.id || '');
        const log = await auditLogService.getLogById(id);
        if (!log) {
            res.status(404).json({
                error: 'Audit log not found',
                message: 'Audit log not found',
            });
            return;
        }
        res.status(200).json(log);
    } catch (err) {
        next(err);
    }
}

// Anonymize logs for a given actor
export async function anonymizeLogs(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actorId = String(req.body?.actor_id || '');
        const dryRun = String(req.query?.dry_run) === 'true';

        if (dryRun) {
            const count = await auditLogService.getAnonymizationCount(actorId);
            res.status(200).json({
                message: 'Dry run completed',
                affected_rows: count,
                actor_id: actorId,
                warning: 'This is a preview. No data was modified.',
            });
            return;
        }

        const affected = await auditLogService.anonymizeLogs(actorId);
        res.status(200).json({
            message: 'Logs anonymized successfully',
            affected_rows: affected,
        });
    } catch (err) {
        next(err);
    }
}

// Get recent login events for a user
export async function getLoginHistory(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { actor_id, limit } = req.query as unknown as LoginHistoryQuery;
        const history = await auditLogService.getLoginHistory(actor_id, limit || 10);
        res.status(200).json(history);
    } catch (err) {
        next(err);
    }
}
