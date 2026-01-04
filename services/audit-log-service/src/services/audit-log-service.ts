import { v4 as uuidv4 } from 'uuid';
import { database } from '../database/database';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import {
    AuditLogEntry,
    PaginatedResponse,
    AuditLogFilters,
    PaginationQuery
} from '../types';

export class AuditLogService {

    async createLog(logData: AuditLogEntry): Promise<{ log: AuditLogEntry; created: boolean }> {
        try {
            // Set timestamp if not provided
            if (!logData.timestamp) {
                logData.timestamp = new Date().toISOString();
            }

            const id = uuidv4();
            const hasOpId = Boolean(logData.operation_id);
            const conflictClause = hasOpId
                ? 'ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING'
                : '';
            const insertQuery = `
                INSERT INTO audit_logs (
                    id, timestamp, service, action, actor, target, 
                    status, operation_id, log_type, metadata, is_anonymized
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ${conflictClause}
                RETURNING *
            `;

            const values = [
                id,
                logData.timestamp,
                logData.service,
                logData.action,
                JSON.stringify(logData.actor),
                logData.target ? JSON.stringify(logData.target) : null,
                logData.status,
                logData.operation_id,
                logData.log_type,
                logData.metadata ? JSON.stringify(logData.metadata) : null,
                logData.is_anonymized || false,
            ];

            const result = await database.query(insertQuery, values);

            if (result.rows.length > 0) {
                const createdLog = this.mapDbRowToLogEntry(result.rows[0]);
                logger.info('Audit log created', {
                    logId: id,
                    service: logData.service
                });
                return { log: createdLog, created: true };
            }

            // If no row returned, conflict occurred (duplicate operation_id).
            // Fetch existing row by operation_id.
            if (logData.operation_id) {
                const selectByOpId = `
                    SELECT * FROM audit_logs 
                    WHERE operation_id = $1 
                    ORDER BY timestamp DESC 
                    LIMIT 1
                `;
                const existing = await database.query(selectByOpId, [logData.operation_id]);
                if (existing.rows.length > 0) {
                    const existingLog = this.mapDbRowToLogEntry(existing.rows[0]);
                    return { log: existingLog, created: false };
                }
            }

            // Fallback: fetch by id
            const byId = await database.query('SELECT * FROM audit_logs WHERE id = $1', [id]);
            if (byId.rows.length > 0) {
                return { log: this.mapDbRowToLogEntry(byId.rows[0]), created: false };
            }

            throw new Error('Failed to create or locate audit log record');

        } catch (error) {
            logger.error('Failed to create audit log', error);
            throw error;
        }
    }

    async getLogs(
        filters: AuditLogFilters = {},
        pagination: PaginationQuery = {}
    ): Promise<PaginatedResponse<AuditLogEntry>> {
        try {
            const page = pagination.page || 1;
            const limit = Math.min(
                pagination.limit || config.defaultPageSize,
                config.maxPageSize
            );
            const offset = (page - 1) * limit;

            // Build WHERE clause
            const conditions: string[] = [];
            const values: unknown[] = [];
            let paramIndex = 1;

            if (filters.service) {
                conditions.push(`service = $${paramIndex++}`);
                values.push(filters.service);
            }

            if (filters.action) {
                conditions.push(`action = $${paramIndex++}`);
                values.push(filters.action);
            }

            if (filters.actor_id) {
                conditions.push(`actor->>'id' = $${paramIndex++}`);
                values.push(filters.actor_id);
            }

            if (filters.target_id) {
                conditions.push(`target->>'id' = $${paramIndex++}`);
                values.push(filters.target_id);
            }

            if (filters.status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(filters.status);
            }

            if (filters.log_type) {
                conditions.push(`log_type = $${paramIndex++}`);
                values.push(filters.log_type);
            }

            if (filters.start_date) {
                conditions.push(`timestamp >= $${paramIndex++}`);
                values.push(filters.start_date);
            }

            if (filters.end_date) {
                conditions.push(`timestamp <= $${paramIndex++}`);
                values.push(filters.end_date);
            }

            const whereClause = conditions.length > 0 ?
                `WHERE ${conditions.join(' AND ')}` : '';

            // Get total count
            const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
            const countResult = await database.query(countQuery, values);
            const total = parseInt(countResult.rows[0].count, 10);

            // Get logs
            const logsQuery = `
                SELECT * FROM audit_logs 
                ${whereClause}
                ORDER BY timestamp DESC 
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;
            values.push(limit, offset);

            const logsResult = await database.query(logsQuery, values);
            const logs = logsResult.rows.map(this.mapDbRowToLogEntry);

            return {
                data: logs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };

        } catch (error) {
            logger.error('Failed to get audit logs', error);
            throw error;
        }
    }

    async getLogById(id: string): Promise<AuditLogEntry | null> {
        try {
            const query = 'SELECT * FROM audit_logs WHERE id = $1';
            const result = await database.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapDbRowToLogEntry(result.rows[0]);

        } catch (error) {
            logger.error('Failed to get audit log by ID', { id, error });
            throw error;
        }
    }

    async getLoginHistory(actorId: string, limit = 10): Promise<AuditLogEntry[]> {
        try {
            const safeLimit = Math.max(1, Math.min(limit, config.maxPageSize));
            const query = `
                SELECT * FROM audit_logs
                WHERE actor->>'id' = $1
                  AND service = 'user-service'
                  AND action = 'login'
                  AND status = 'success'
                ORDER BY timestamp DESC
                LIMIT $2
            `;

            const result = await database.query(query, [actorId, safeLimit]);
            return result.rows.map(this.mapDbRowToLogEntry);
        } catch (error) {
            logger.error('Failed to get login history', { actorId, error });
            throw error;
        }
    }

    async getAnonymizationCount(actorId: string): Promise<number> {
        try {
            const query = `
                SELECT COUNT(*) as count 
                FROM audit_logs 
                WHERE actor->>'id' = $1 AND is_anonymized = false
            `;

            const result = await database.query(query, [actorId]);
            const count = parseInt(result.rows[0].count, 10);

            logger.info('Anonymization count check', { actorId, count });
            return count;

        } catch (error) {
            logger.error('Failed to get anonymization count', { actorId, error });
            throw error;
        }
    }

    async anonymizeLogs(actorId: string): Promise<number> {
        try {
            const query = `
                UPDATE audit_logs 
                SET is_anonymized = true,
                    actor = jsonb_set(actor, '{id}', '"[ANONYMIZED]"'),
                    metadata = CASE 
                        WHEN metadata IS NOT NULL 
                        THEN jsonb_set(metadata, '{anonymized_at}', to_jsonb(NOW()::text))
                        ELSE jsonb_build_object('anonymized_at', NOW()::text)
                    END
                WHERE actor->>'id' = $1 AND is_anonymized = false
            `;

            const result = await database.query(query, [actorId]);
            const affectedRows = result.rowCount || 0;

            logger.info('Anonymized audit logs', { actorId, affectedRows });
            return affectedRows;

        } catch (error) {
            logger.error('Failed to anonymize audit logs', { actorId, error });
            throw error;
        }
    }

    async cleanupOldLogs(): Promise<number> {
        try {
            // eslint-disable-next-line max-len
            const query = `DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '${config.logRetentionDays} days' RETURNING id`;
            const result = await database.query(query);
            const deletedCount = result.rowCount || 0;

            logger.debug('Cleaned up old audit logs', { deletedCount });
            return deletedCount;

        } catch (error) {
            logger.error('Failed to cleanup old audit logs', error);
            throw error;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private mapDbRowToLogEntry(row: any): AuditLogEntry {
        return {
            id: row.id,
            timestamp: row.timestamp,
            service: row.service,
            action: row.action,
            actor: row.actor,
            target: row.target,
            status: row.status,
            operation_id: row.operation_id,
            log_type: row.log_type,
            metadata: row.metadata,
            is_anonymized: row.is_anonymized,
        };
    }
}

export const auditLogService = new AuditLogService();
