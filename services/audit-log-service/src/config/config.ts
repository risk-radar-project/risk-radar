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
    kafkaConnectMaxRetries: number;
    kafkaConnectRetryInitialDelayMs: number;
    kafkaConnectRetryMaxDelayMs: number;
    kafkaConnectRetryBackoffMultiplier: number;
}

const kafkaBrokers = (process.env.KAFKA_BROKERS || '')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

const kafkaTopic = (process.env.KAFKA_TOPIC || 'audit_logs').trim();

const kafkaConnectMaxRetries = Math.max(
    1,
    parseInt(process.env.KAFKA_CONNECT_MAX_RETRIES || '12', 10)
);

const kafkaConnectRetryInitialDelayMs = Math.max(
    100,
    parseInt(process.env.KAFKA_CONNECT_RETRY_INITIAL_DELAY_MS || '1000', 10)
);

const kafkaConnectRetryMaxDelayMs = Math.max(
    kafkaConnectRetryInitialDelayMs,
    parseInt(process.env.KAFKA_CONNECT_RETRY_MAX_DELAY_MS || '15000', 10)
);

const kafkaConnectRetryBackoffMultiplierRaw = Number.parseFloat(
    process.env.KAFKA_CONNECT_RETRY_BACKOFF_MULTIPLIER || '1.8'
);

const kafkaConnectRetryBackoffMultiplier = Number.isFinite(kafkaConnectRetryBackoffMultiplierRaw) &&
    kafkaConnectRetryBackoffMultiplierRaw > 1
    ? kafkaConnectRetryBackoffMultiplierRaw
    : 1.8;

const databaseUrl = (process.env.DATABASE_URL || '').trim();
if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required.');
}

const DEFAULT_LOG_RETENTION_DAYS = 365;
const MIN_LOG_RETENTION_DAYS = 1;
const MAX_LOG_RETENTION_DAYS = 1825; // five years aligns with reliability expectations

const rawRetention = (process.env.LOG_RETENTION_DAYS || `${DEFAULT_LOG_RETENTION_DAYS}`).trim();
const parsedRetention = Number.parseInt(rawRetention, 10);

if (
    Number.isNaN(parsedRetention) ||
    parsedRetention < MIN_LOG_RETENTION_DAYS ||
    parsedRetention > MAX_LOG_RETENTION_DAYS
) {
    const retentionRange = `${MIN_LOG_RETENTION_DAYS}-${MAX_LOG_RETENTION_DAYS}`;
    throw new Error(
        `LOG_RETENTION_DAYS must be within ${retentionRange}. Received: ${rawRetention}`
    );
}

export const config: Config = {
    port: parseInt(process.env.PORT || '8080', 10),
    databaseUrl,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    logDbQueries: process.env.LOG_DB_QUERIES === 'true',
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '50', 10),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '1000', 10),
    logRetentionDays: parsedRetention,
    websocketEnabled: process.env.WEBSOCKET_ENABLED === 'true',
    kafkaEnabled: kafkaBrokers.length > 0,
    kafkaBrokers,
    kafkaClientId: (process.env.KAFKA_CLIENT_ID || 'audit-log-service').trim(),
    kafkaGroupId: (process.env.KAFKA_GROUP_ID || 'audit-log-service-consumer').trim(),
    kafkaTopic,
    kafkaConnectMaxRetries,
    kafkaConnectRetryInitialDelayMs,
    kafkaConnectRetryMaxDelayMs,
    kafkaConnectRetryBackoffMultiplier,
};
