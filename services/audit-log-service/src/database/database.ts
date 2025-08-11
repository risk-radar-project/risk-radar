import { Pool, PoolClient } from 'pg';
import { config } from '../config/config';
import { logger } from '../utils/logger';

class Database {
    private pool: Pool;
    private isConnected: boolean = false;

    constructor() {
        this.pool = new Pool({
            connectionString: config.databaseUrl,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
            logger.error('Unexpected error on idle client', err);
            this.isConnected = false;
        });

        this.pool.on('connect', () => {
            if (!this.isConnected) {
                logger.info('Database connection established');
                this.isConnected = true;
            }
        });
    }

    async waitForConnection(maxRetries: number = 30, retryInterval: number = 2000): Promise<void> {
        let retries = 0;

        while (retries < maxRetries) {
            try {
                const attempt = retries + 1;
                logger.info(
                    `Attempting to connect to database (attempt ${attempt}/${maxRetries})`
                );
                await this.query('SELECT 1');
                logger.info('Database connection successful');
                this.isConnected = true;
                return;
            } catch (error) {
                retries++;
                logger.warn(`Database connection failed (attempt ${retries}/${maxRetries}):`, {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    nextRetryIn: retryInterval
                });

                if (retries >= maxRetries) {
                    throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
                }

                await this.sleep(retryInterval);

                // Exponential backoff with jitter
                retryInterval = Math.min(retryInterval * 1.5 + Math.random() * 1000, 10000);
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getClient(): Promise<PoolClient> {
        if (!this.isConnected) {
            await this.waitForConnection();
        }
        return this.pool.connect();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async query(text: string, params?: unknown[]): Promise<any> {
        const start = Date.now();
        let client: PoolClient | null = null;

        try {
            client = await this.pool.connect();
            const result = await client.query(text, params);
            const duration = Date.now() - start;

            // Only log if enabled in config or slow queries (>100ms)
            if (config.logDbQueries || duration > 100) {
                logger.debug('Executed query', { text, duration, rows: result.rowCount });
            }

            return result;
        } catch (error) {
            // Mark as disconnected if connection error
            if (error instanceof Error && (
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('ENOTFOUND') ||
                error.message.includes('timeout')
            )) {
                this.isConnected = false;
            }
            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
        this.isConnected = false;
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            return true;
        } catch (error) {
            logger.error('Database health check failed', error);
            return false;
        }
    }
}

export const database = new Database();
