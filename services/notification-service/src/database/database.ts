import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { config } from "../config/config";
import { logger } from "../utils/logger";

class Database {
    private pool: Pool;
    private connected = false;

    constructor() {
        this.pool = new Pool({
            connectionString: config.databaseUrl,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        this.pool.on("error", (error: Error) => {
            logger.error("Unexpected database error", { error: error.message });
            this.connected = false;
        });

        this.pool.on("connect", () => {
            if (!this.connected) {
                logger.debug("Notification DB connection established");
                this.connected = true;
            }
        });
    }

    async waitForConnection(maxRetries = 20, retryInterval = 2000): Promise<void> {
        if (this.connected) {
            return;
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.pool.query("SELECT 1");
                this.connected = true;
                return;
            } catch (error) {
                logger.warn("Database connection attempt failed", {
                    attempt,
                    maxRetries,
                    error: error instanceof Error ? error.message : "Unknown error"
                });
                await new Promise((resolve) => setTimeout(resolve, retryInterval));
            }
        }
        throw new Error("Could not connect to database");
    }

    async getClient(): Promise<PoolClient> {
        if (!this.connected) {
            await this.waitForConnection();
        }
        return this.pool.connect();
    }

    async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
    ): Promise<QueryResult<T>> {
        if (!this.connected) {
            await this.waitForConnection();
        }
        try {
            const result = await this.pool.query<T>(text, params);
            if (config.logDbQueries) {
                logger.debug("DB query executed", { text });
            }
            return result;
        } catch (error) {
            this.connected = false;
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.query("SELECT 1");
            return true;
        } catch (error) {
            logger.error("Database health check failed", { error });
            return false;
        }
    }
}

export const database = new Database();
