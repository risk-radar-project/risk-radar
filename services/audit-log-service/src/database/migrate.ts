import { database } from './database';
import { logger } from '../utils/logger';

const CREATE_PGCRYPTO = `
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
`;

const CREATE_AUDIT_LOGS_TABLE = `
    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        service VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        actor JSONB NOT NULL,
        target JSONB,
        status VARCHAR(50) NOT NULL CHECK (
            status IN ('success', 'failure', 'warning', 'error')
        ),
        operation_id VARCHAR(255),
        log_type VARCHAR(50) NOT NULL CHECK (
            log_type IN ('ACTION', 'SECURITY', 'SYSTEM', 'ERROR', 'INFO')
        ),
        metadata JSONB,
        is_anonymized BOOLEAN NOT NULL DEFAULT FALSE
    );
`;

const CREATE_INDEXES = `
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_service ON audit_logs (service);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs (status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_log_type ON audit_logs (log_type);
    -- drop legacy non-unique operation_id index if present,
    -- then create unique index for DB-level idempotency
    DROP INDEX IF EXISTS idx_audit_logs_operation_id;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_logs_operation_id
        ON audit_logs (operation_id)
        WHERE operation_id IS NOT NULL;
    -- expression indexes to speed up equality filters on JSONB ids
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs ((actor->>'id'));
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs ((target->>'id'));
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_gin ON audit_logs USING GIN (actor);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target_gin ON audit_logs USING GIN (target);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin ON audit_logs USING GIN (metadata);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_is_anonymized ON audit_logs (is_anonymized);
`;

export async function runMigrations(): Promise<void> {
    try {
        logger.debug('Starting database migrations...');

        // Wait for database connection with retry
        await database.waitForConnection();

        // Ensure required extensions are available before creating objects that
        // depend on them
        logger.debug('Ensuring pgcrypto extension is installed...');
        await database.query(CREATE_PGCRYPTO);

        logger.debug('Running table creation migration...');
        await database.query(CREATE_AUDIT_LOGS_TABLE);

        logger.debug('Creating database indexes...');
        await database.query(CREATE_INDEXES);

        logger.debug('Database migrations completed successfully');
    } catch (error) {
        logger.error('Database migration failed', error);
        throw error;
    }
}

// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations()
        .then(() => {
            logger.info('Migrations completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration failed', error);
            process.exit(1);
        });
}
