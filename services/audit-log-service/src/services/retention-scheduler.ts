import { auditLogService } from '../services/audit-log-service';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export class RetentionScheduler {
    private intervalId: NodeJS.Timeout | null = null;
    private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    start(): void {
        if (this.intervalId) {
            logger.warn('Retention scheduler is already running');
            return;
        }

        logger.info('Starting retention scheduler', {
            retentionDays: config.logRetentionDays,
            intervalHours: this.CLEANUP_INTERVAL / (60 * 60 * 1000)
        });

        // Run immediately on startup
        this.performCleanup();

        // Schedule daily cleanup
        this.intervalId = setInterval(() => {
            this.performCleanup();
        }, this.CLEANUP_INTERVAL);
        this.intervalId.unref?.();
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Retention scheduler stopped');
        }
    }

    private async performCleanup(): Promise<void> {
        try {
            logger.debug('Starting scheduled log cleanup');
            const deletedCount = await auditLogService.cleanupOldLogs();

            if (deletedCount > 0) {
                logger.debug('Scheduled cleanup completed', { deletedCount });
            } else {
                logger.debug('No old logs found for cleanup');
            }
        } catch (error) {
            logger.error('Scheduled cleanup failed', error);
        }
    }
}

export const retentionScheduler = new RetentionScheduler();
