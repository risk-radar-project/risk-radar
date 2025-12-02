import { Kafka, Consumer, EachMessagePayload, logLevel, LogEntry } from 'kafkajs';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { auditLogService } from '../services/audit-log-service';
import { createLogSchema } from '../validation/schemas';
import { AuditLogEntry } from '../types';
import { getWebSocketHandler } from '../websocket/websocket-handler';

let kafkaConsumer: Consumer | null = null;
let consumerRunPromise: Promise<void> | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let kafkaInitializing = false;
let kafkaStopRequested = false;

export type KafkaConnectionState =
    | 'disabled'
    | 'connecting'
    | 'connected'
    | 'error'
    | 'reconnecting'
    | 'stopped';

export interface KafkaConnectionStatus {
    enabled: boolean;
    state: KafkaConnectionState;
    lastError?: string | null;
    lastConnectedAt?: string | null;
    retryScheduledAt?: string | null;
}

let kafkaStatus: KafkaConnectionStatus = {
    enabled: config.kafkaEnabled,
    state: config.kafkaEnabled ? 'stopped' : 'disabled',
    retryScheduledAt: null,
    lastConnectedAt: null,
    lastError: null,
};

const updateKafkaStatus = (partial: Partial<KafkaConnectionStatus>): void => {
    const sanitizedEntries = Object.entries(partial).filter(([, value]) => typeof value !== 'undefined');
    const sanitized = Object.fromEntries(sanitizedEntries) as Partial<KafkaConnectionStatus>;

    kafkaStatus = {
        ...kafkaStatus,
        ...sanitized,
        enabled: config.kafkaEnabled,
    };
};

export const getKafkaStatus = (): KafkaConnectionStatus => ({ ...kafkaStatus });

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function connectConsumerWithRetry(consumer: Consumer): Promise<void> {
    const {
        kafkaConnectMaxRetries,
        kafkaConnectRetryInitialDelayMs,
        kafkaConnectRetryMaxDelayMs,
        kafkaConnectRetryBackoffMultiplier,
    } = config;

    let attempt = 0;
    let delay = kafkaConnectRetryInitialDelayMs;
    let lastError: unknown;

    while (attempt < kafkaConnectMaxRetries) {
        attempt++;

        try {
            logger.info(
                `Attempting to connect to Kafka (attempt ${attempt}/${kafkaConnectMaxRetries})`
            );

            await consumer.connect();
            await consumer.subscribe({ topic: config.kafkaTopic, fromBeginning: false });

            logger.info('Kafka consumer connected and subscribed', {
                brokers: config.kafkaBrokers,
                topic: config.kafkaTopic,
                groupId: config.kafkaGroupId,
            });

            return;
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : 'Unknown error';

            logger.warn('Kafka connection attempt failed', {
                attempt,
                maxRetries: kafkaConnectMaxRetries,
                retryInMs: attempt >= kafkaConnectMaxRetries ? 0 : delay,
                error: message,
            });

            await consumer.disconnect().catch(() => undefined);

            if (attempt >= kafkaConnectMaxRetries) {
                break;
            }

            await sleep(delay);
            delay = Math.min(
                Math.round(delay * kafkaConnectRetryBackoffMultiplier),
                kafkaConnectRetryMaxDelayMs
            );
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error('Failed to connect to Kafka after configured retries');
}

export interface KafkaMessageContext {
    topic: string;
    partition: number;
    offset: string;
    key?: string | null;
}

const createKafkaLogCreator = (): (logEntry: LogEntry) => void =>
    ({ namespace, level, label, log }: LogEntry) => {
        const message = log?.message || 'Kafka client event';
        const details = {
            namespace,
            label,
            ...log,
        };

        const RESET = '\u001B[0m';
        const MAGENTA = '\u001B[35m';
        const GRAY = '\u001B[90m';
        const prefix = `${MAGENTA}Kafka${RESET}`;
        const detailText = Object.keys(details).length > 0
            ? ` ${GRAY}${JSON.stringify(details)}${RESET}`
            : '';
        const formattedMessage = `${prefix} | ${namespace} | ${message}${detailText}`;

        switch (level) {
        case logLevel.ERROR:
            logger.error(formattedMessage);
            break;
        case logLevel.WARN:
            logger.warn(formattedMessage);
            break;
        case logLevel.INFO:
            logger.info(formattedMessage);
            break;
        default:
            logger.debug(formattedMessage);
        }
    };

const scheduleKafkaReconnect = (): void => {
    if (kafkaStopRequested || !config.kafkaEnabled) {
        return;
    }

    if (reconnectTimeout || kafkaInitializing) {
        return;
    }

    const delay = config.kafkaConnectRetryMaxDelayMs;
    const retryAt = new Date(Date.now() + delay).toISOString();

    updateKafkaStatus({ state: 'reconnecting', retryScheduledAt: retryAt });

    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        void attemptKafkaStartup();
    }, delay);
};

const handleKafkaRunFailure = async (error: unknown): Promise<void> => {
    if (kafkaStopRequested) {
        return;
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error('Kafka consumer run loop stopped unexpectedly', { error: message });

    updateKafkaStatus({ state: 'error', lastError: message, retryScheduledAt: null });

    try {
        await kafkaConsumer?.disconnect();
    } catch {
        // ignore
    }

    consumerRunPromise = null;
    kafkaConsumer = null;

    scheduleKafkaReconnect();
};

const attemptKafkaStartup = async (): Promise<void> => {
    if (kafkaStopRequested || kafkaInitializing || kafkaConsumer) {
        return;
    }

    kafkaInitializing = true;
    updateKafkaStatus({ state: 'connecting', retryScheduledAt: null });

    const kafka = new Kafka({
        clientId: config.kafkaClientId,
        brokers: config.kafkaBrokers,
        logCreator: createKafkaLogCreator,
    });

    const consumer = kafka.consumer({ groupId: config.kafkaGroupId });
    kafkaConsumer = consumer;

    try {
        await connectConsumerWithRetry(consumer);

        const handleConnectEvent = (): void => {
            updateKafkaStatus({
                state: 'connected',
                lastError: null,
                lastConnectedAt: new Date().toISOString(),
                retryScheduledAt: null,
            });
        };

        const handleCrashEvent = (event: { payload?: { error?: Error } }): void => {
            const error = event.payload?.error;
            const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
            logger.error('Kafka consumer crashed', { error: message });
            void handleKafkaRunFailure(error ?? new Error(message));
        };

        const handleDisconnectEvent = (event: { payload?: { error?: Error } }): void => {
            const error = event.payload?.error;
            const message = error instanceof Error ? error.message : String(error ?? 'Disconnected');
            logger.warn('Kafka consumer disconnected', { error: message });
            if (!kafkaStopRequested) {
                void handleKafkaRunFailure(error ?? new Error(message));
            }
        };

        kafkaConsumer.on('consumer.connect', handleConnectEvent);
        kafkaConsumer.on('consumer.crash', handleCrashEvent);
        kafkaConsumer.on('consumer.disconnect', handleDisconnectEvent);

        consumerRunPromise = kafkaConsumer.run({
            eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
                const offset = message.offset;
                const key = message.key ? message.key.toString() : null;

                if (!message.value) {
                    logger.warn('Received Kafka message without value', {
                        topic,
                        partition,
                        offset,
                        key,
                    });
                    return;
                }

                await processKafkaMessage(message.value, { topic, partition, offset, key });
            },
        });

        consumerRunPromise.catch((error) => {
            void handleKafkaRunFailure(error);
        });

        handleConnectEvent();

        logger.info('Kafka consumer started', {
            brokers: config.kafkaBrokers,
            topic: config.kafkaTopic,
            groupId: config.kafkaGroupId,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Kafka consumer failed to start', { error: message });

        try {
            await consumer.disconnect();
        } catch {
            // ignore
        }

        consumerRunPromise = null;
        kafkaConsumer = null;

        updateKafkaStatus({ state: 'error', lastError: message, retryScheduledAt: null });
        scheduleKafkaReconnect();
    } finally {
        kafkaInitializing = false;
    }
};

export async function startKafkaConsumer(): Promise<void> {
    if (!config.kafkaEnabled) {
        updateKafkaStatus({ state: 'disabled', lastError: null, retryScheduledAt: null });
        logger.info('Kafka consumer is disabled. Set KAFKA_BROKERS to enable ingestion.');
        return;
    }

    kafkaStopRequested = false;

    if (kafkaConsumer || kafkaInitializing) {
        logger.warn('Attempted to start Kafka consumer, but it is already running.');
        return;
    }

    void attemptKafkaStartup();
}

export async function stopKafkaConsumer(): Promise<void> {
    kafkaStopRequested = true;

    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (!kafkaConsumer) {
        updateKafkaStatus({
            state: config.kafkaEnabled ? 'stopped' : 'disabled',
            retryScheduledAt: null,
        });
        return;
    }

    try {
        await kafkaConsumer.stop();
        await consumerRunPromise?.catch(() => undefined);
        await kafkaConsumer.disconnect();
        logger.info('Kafka consumer stopped');
    } catch (error) {
        logger.warn('Failed to stop Kafka consumer cleanly', {
            error: error instanceof Error ? error.message : error,
        });
    } finally {
        consumerRunPromise = null;
        kafkaConsumer = null;
        kafkaInitializing = false;
        updateKafkaStatus({
            state: config.kafkaEnabled ? 'stopped' : 'disabled',
            retryScheduledAt: null,
        });
    }
}

export async function processKafkaMessage(
    value: Buffer | string,
    context: KafkaMessageContext
): Promise<void> {
    const rawPayload = typeof value === 'string' ? value : value.toString('utf-8');

    if (!rawPayload.trim()) {
        logger.warn('Skipping Kafka message with empty payload', context);
        return;
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(rawPayload);
    } catch (error) {
        logger.warn('Failed to parse Kafka message as JSON', {
            ...context,
            error: error instanceof Error ? error.message : error,
        });
        return;
    }

    const { error: validationError, value: validated } = createLogSchema.validate(parsed, {
        abortEarly: false,
    });

    if (validationError) {
        logger.warn('Invalid Kafka audit log payload received', {
            ...context,
            errors: validationError.details.map((detail) => detail.message),
        });
        return;
    }

    const logPayload: AuditLogEntry = {
        ...(validated as AuditLogEntry),
    };

    if (!logPayload.timestamp) {
        logPayload.timestamp = new Date().toISOString();
    }

    if (typeof logPayload.is_anonymized === 'undefined') {
        logPayload.is_anonymized = false;
    }

    try {
        const { created, log } = await auditLogService.createLog(logPayload);

        if (!created) {
            logger.debug('Kafka audit log skipped due to idempotency', {
                ...context,
                operationId: logPayload.operation_id,
            });
            return;
        }

        const wsHandler = getWebSocketHandler();
        if (wsHandler) {
            wsHandler.broadcastNewLog(log);
        }
    } catch (error) {
        logger.error('Failed to persist Kafka audit log', {
            ...context,
            error: error instanceof Error ? error.message : error,
        });
    }
}
