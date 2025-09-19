import { Pool, PoolClient } from 'pg';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

const connectionString = process.env.DATABASE_URL || '';
if (!connectionString && (process.env.NODE_ENV || '').toLowerCase() !== 'test') {
    throw new Error('Missing required env var DATABASE_URL');
}

interface QueryResultWrapper<T> { rows: T[] }

class Database {
    private pool: Pool;
    private isConnected = false;
    private bootstrapAttempts = 0;
    private bootstrapLastError: string | null = null;
    private bootstrapStartedAt: number | null = null;

    constructor() {
        const ssl = /sslmode=require|ssl=true/i.test(connectionString);
        this.pool = new Pool({
            connectionString,
            max: parseInt(process.env.PG_MAX_CLIENTS || '20', 10),
            idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10),
            connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT_MS || '5000', 10),
            ssl: ssl ? { rejectUnauthorized: false } : undefined,
        });

        this.pool.on('error', (err) => {
            logger.error('DB pool error (idle client)', { err: err.message });
            this.isConnected = false;
        });

        this.pool.on('connect', () => {
            if (!this.isConnected) {
                logger.info('Database connection established');
                this.isConnected = true;
            }
        });
    }

    private sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

    async waitForConnection(maxRetries = config.db.bootstrapRetries, retryInterval = config.db.bootstrapDelayMs, maxWaitMs = config.db.bootstrapMaxWaitMs): Promise<void> {
        this.bootstrapStartedAt = Date.now();
        const start = Date.now();
        let attempt = 0;
        this.bootstrapAttempts = 0;
        while (attempt < maxRetries) {
            attempt++;
            this.bootstrapAttempts = attempt;
            try {
                logger.debug('DB connect attempt', { attempt, maxRetries });
                await this.query('SELECT 1');
                logger.info('Database connection successful');
                this.isConnected = true;
                this.bootstrapLastError = null;
                return;
            } catch (err: any) {
                const msg = err?.message || String(err);
                this.bootstrapLastError = msg;
                logger.warn('DB connection attempt failed', { attempt, maxRetries, error: msg });
                const elapsed = Date.now() - start;
                if (elapsed >= maxWaitMs) {
                    throw new Error(`Failed to connect to database within max wait ${maxWaitMs}ms: ${msg}`);
                }
                if (attempt >= maxRetries) {
                    throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${msg}`);
                }
                await this.sleep(retryInterval);
                retryInterval = Math.min(retryInterval * 1.5 + Math.random() * 1000, 10_000);
            }
        }
    }

    getBootstrapInfo() {
        return {
            attempts: this.bootstrapAttempts,
            lastError: this.bootstrapLastError,
            startedAt: this.bootstrapStartedAt,
            isConnected: this.isConnected,
        };
    }

    async getClient(): Promise<PoolClient> {
        if (!this.isConnected) {
            await this.waitForConnection();
        }
        return this.pool.connect();
    }

    async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResultWrapper<T>> {
        let client: PoolClient | null = null;
        const start = Date.now();
        try {
            client = await this.pool.connect();
            const res = await client.query(text as any, params as any);
            const duration = Date.now() - start;
            if (config.nodeEnv !== 'production' && duration > 100) {
                logger.debug('Slow query', { text, duration, rows: res.rowCount });
            }
            return { rows: res.rows as T[] };
        } catch (err: any) {
            const msg = err?.message || String(err);
            if (/ECONNREFUSED|ENOTFOUND|timeout/i.test(msg)) {
                this.isConnected = false;
            }
            throw err;
        } finally {
            if (client) client.release();
        }
    }

    async health(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            return true;
        } catch (e) {
            logger.debug('Health check failed', { error: (e as any)?.message });
            return false;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
        this.isConnected = false;
    }
}

const database = new Database();

export const db = {
    query: <T = unknown>(text: string, params?: unknown[]) => database.query<T>(text, params),
    health: () => database.health(),
    close: () => database.close(),
    pool: (database as any).pool,
    waitForConnection: (max?: number, interval?: number, maxWaitMs?: number) => database.waitForConnection(max, interval, maxWaitMs),
    getClient: () => database.getClient(),
    getBootstrapInfo: () => (database as any).getBootstrapInfo?.() || { attempts: 0, lastError: null, startedAt: null, isConnected: false },
};

export { database };
