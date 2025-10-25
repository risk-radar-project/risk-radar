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
    kafkaEnabled: boolean;
    kafkaBrokers: string[];
    kafkaClientId: string;
    kafkaGroupId: string;
    kafkaTopic: string;
}

const kafkaBrokers = (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

const kafkaTopic = (process.env.KAFKA_TOPIC || 'audit_logs').trim();

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
    kafkaEnabled: kafkaBrokers.length > 0,
    kafkaBrokers,
    kafkaClientId: (process.env.KAFKA_CLIENT_ID || 'audit-log-service').trim(),
    kafkaGroupId: (process.env.KAFKA_GROUP_ID || 'audit-log-service-consumer').trim(),
    kafkaTopic,
};
