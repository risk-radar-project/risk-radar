import dotenv from "dotenv";

dotenv.config();

const DEFAULT_EMAIL_DELAYS = [15000, 30000, 120000, 600000, 1800000];

function parseNumber(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
    if (!value) {
        return fallback;
    }
    return value.toLowerCase() === "true";
}

function parseRetrySchedule(raw: string | undefined): number[] {
    if (!raw) {
        return DEFAULT_EMAIL_DELAYS;
    }
    const parts = raw.split(",");
    const delays = parts
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((val) => !Number.isNaN(val) && val > 0);
    return delays.length > 0 ? delays : DEFAULT_EMAIL_DELAYS;
}

function parseList(raw: string | undefined): string[] {
    if (!raw) {
        return [];
    }
    return raw
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

const kafkaBrokers = parseList(process.env.KAFKA_BROKERS);
const auditKafkaBrokers = parseList(process.env.AUDIT_KAFKA_BROKERS || process.env.KAFKA_BROKERS);

function parseKafkaAcks(raw: string | undefined, fallback: -1 | 0 | 1): -1 | 0 | 1 {
    if (!raw) {
        return fallback;
    }
    const normalized = raw.trim();
    if (normalized === "-1" || normalized.toLowerCase() === "all") {
        return -1;
    }
    if (normalized === "0") {
        return 0;
    }
    if (normalized === "1") {
        return 1;
    }
    return fallback;
}

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required.");
}

export interface Config {
    port: number;
    nodeEnv: string;
    logLevel: string;
    logDbQueries: boolean;
    logKafkaEvents: boolean;
    databaseUrl: string;
    kafkaBrokers: string[];
    kafkaClientId: string;
    kafkaGroupId: string;
    kafkaTopic: string;
    kafkaConnectRetryAttempts: number;
    kafkaConnectRetryInitialDelayMs: number;
    kafkaConnectRetryMaxDelayMs: number;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string | undefined;
    smtpPassword: string | undefined;
    mailFrom: string;
    userServiceBaseUrl: string;
    auditServiceBaseUrl: string;
    auditHttpTimeoutMs: number;
    auditHttpRetries: number;
    auditKafka: {
        enabled: boolean;
        brokers: string[];
        topic: string;
        clientId: string;
        acks: -1 | 0 | 1;
        connectionTimeoutMs: number;
        requestTimeoutMs: number;
        sendTimeoutMs: number;
        idempotent: boolean;
    };
    emailRetryDelays: number[];
    emailPollIntervalMs: number;
    emailSchedulerBatchSize: number;
    emailSchedulerConcurrency: number;
}

export const config: Config = {
    port: parseNumber(process.env.PORT, 8086),
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
    logDbQueries: parseBoolean(process.env.LOG_DB_QUERIES),
    logKafkaEvents: parseBoolean(process.env.LOG_KAFKA_EVENTS),
    databaseUrl,
    kafkaBrokers,
    kafkaClientId: process.env.KAFKA_CLIENT_ID || "notification-service",
    kafkaGroupId: process.env.KAFKA_GROUP_ID || "notification-service-consumer",
    kafkaTopic: process.env.KAFKA_TOPIC || "notification_events",
    kafkaConnectRetryAttempts: parseNumber(process.env.KAFKA_CONNECT_MAX_RETRIES, 5),
    kafkaConnectRetryInitialDelayMs: parseNumber(process.env.KAFKA_CONNECT_INITIAL_DELAY_MS, 2000),
    kafkaConnectRetryMaxDelayMs: parseNumber(process.env.KAFKA_CONNECT_MAX_DELAY_MS, 30000),
    smtpHost: process.env.SMTP_HOST || "mailpit",
    smtpPort: parseNumber(process.env.SMTP_PORT, 1025),
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    mailFrom: process.env.MAIL_FROM || "Powiadomienia <no-reply@riskradar.local>",
    userServiceBaseUrl: process.env.USER_SERVICE_BASE_URL || "http://user-service:8080",
    auditServiceBaseUrl: process.env.AUDIT_LOG_SERVICE_BASE_URL || "http://audit-log-service:8080",
    auditHttpTimeoutMs: parseNumber(process.env.AUDIT_HTTP_TIMEOUT_MS, 3000),
    auditHttpRetries: parseNumber(process.env.AUDIT_HTTP_RETRIES, 2),
    auditKafka: {
        enabled: parseBoolean(process.env.AUDIT_KAFKA_ENABLED, auditKafkaBrokers.length > 0),
        brokers: auditKafkaBrokers,
        topic: process.env.AUDIT_KAFKA_TOPIC || "audit_logs",
        clientId: process.env.AUDIT_KAFKA_CLIENT_ID || "notification-service",
        acks: parseKafkaAcks(process.env.AUDIT_KAFKA_ACKS, -1),
        connectionTimeoutMs: parseNumber(process.env.AUDIT_KAFKA_CONNECTION_TIMEOUT_MS, 3000),
        requestTimeoutMs: parseNumber(process.env.AUDIT_KAFKA_REQUEST_TIMEOUT_MS, 5000),
        sendTimeoutMs: parseNumber(process.env.AUDIT_KAFKA_SEND_TIMEOUT_MS, 5000),
        idempotent: parseBoolean(process.env.AUDIT_KAFKA_IDEMPOTENT, true),
    },
    emailRetryDelays: parseRetrySchedule(process.env.EMAIL_RETRY_DELAYS_MS),
    emailPollIntervalMs: parseNumber(process.env.EMAIL_POLL_INTERVAL_MS, 10000),
    emailSchedulerBatchSize: parseNumber(process.env.EMAIL_SCHEDULER_BATCH_SIZE, 50),
    emailSchedulerConcurrency: parseNumber(process.env.EMAIL_SCHEDULER_CONCURRENCY, 5),
};
