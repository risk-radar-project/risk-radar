import dotenv from 'dotenv';

dotenv.config();

export interface Config {
    port: number;
    databaseUrl: string;
    nodeEnv: string;
    logLevel: string;
    logDbQueries: boolean;
    defaultPageSize: number;
    maxPageSize: number;
    logRetentionDays: number;
    websocketEnabled: boolean;
}

export const config: Config = {
    port: parseInt(process.env.PORT || '8080', 10),
    databaseUrl: process.env.DATABASE_URL ||
        'postgres://risk-radar-admin:passwd@localhost:5432/risk-radar?sslmode=disable',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    logDbQueries: process.env.LOG_DB_QUERIES === 'true',
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '50', 10),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '1000', 10),
    logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '365', 10),
    websocketEnabled: process.env.WEBSOCKET_ENABLED === 'true',
};
