import { Request, Response } from 'express';
import { config } from '../config/config.js';
import { getDiskUsage } from '../storage/fs-storage.js';
import { counters } from '../domain/counters.js';
import { db } from '../db/pool.js';
import { emitAudit } from '../audit/audit-emitter.js';
import { auditEvents } from '../audit/events.js';
import { breakersStatus } from '../domain/circuit-breaker.js';
import { logger } from '../logger/logger.js';

export const statusController = {
    getStatus: async (_req: Request, res: Response) => {
        const now = new Date();
        const disk = await getDiskUsage(config.mediaRoot);
        const usedPercent = disk.totalBytes > 0 ? Math.round((disk.usedBytes / disk.totalBytes) * 100) : 0;
        const storage_warn = usedPercent >= config.storageThresholds.warnPercent;
        const storage_critical = usedPercent >= config.storageThresholds.criticalPercent;

        const dbHealthy = await db.health();
        const dbBootstrap = (db as any).getBootstrapInfo ? (db as any).getBootstrapInfo() : { attempts: 0, lastError: null, startedAt: null, isConnected: false };

        const breakers = breakersStatus();
        logger.debug('status_breakers_snapshot', { breakers });
        const auditBreaker = breakers.find(b => b.name === 'audit');
        const authzBreaker = breakers.find(b => b.name === 'authz');
        logger.debug('status_breakers_selected', { audit: auditBreaker?.state, authz: authzBreaker?.state });

        const mapState = (s: string | undefined) => {
            switch (s) {
                case 'closed': return 'active';
                case 'open': return 'unavailable';
                case 'half_open': return 'probing';
                default: return 'unknown';
            }
        };

        const payload = {
            http_status: 'OK',
            timestamp: now.toISOString(),
            database_connection: dbHealthy ? 'healthy' : 'unhealthy',
            database_bootstrap: {
                attempts: dbBootstrap.attempts,
                last_error: dbBootstrap.lastError,
                started_at: dbBootstrap.startedAt ? new Date(dbBootstrap.startedAt).toISOString() : null,
                is_connected: !!dbBootstrap.isConnected,
            },
            dependencies: {
                audit: mapState(auditBreaker?.state),
                authz: mapState(authzBreaker?.state),
            },
            dependencies_raw: {
                audit: auditBreaker?.state || 'unknown',
                authz: authzBreaker?.state || 'unknown',
            },
            media_root: disk.root,
            disk_total_bytes: disk.totalBytes,
            disk_used_bytes: disk.usedBytes,
            disk_used_percent: usedPercent,
            storage_warn,
            storage_critical,
            uploads_total: counters.uploads,
            reads_master_total: counters.reads.master,
            reads_thumb_total: counters.reads.thumb,
            reads_preview_total: counters.reads.preview,
            deletes_total: counters.deletes,
        };

        // Emit threshold events best-effort
        if (storage_critical) {
            emitAudit(auditEvents.storageThreshold('critical', usedPercent, disk.usedBytes)).catch(() => undefined);
        } else if (storage_warn) {
            emitAudit(auditEvents.storageThreshold('warn', usedPercent, disk.usedBytes)).catch(() => undefined);
        }

        return res.status(200).json(payload);
    },
};
