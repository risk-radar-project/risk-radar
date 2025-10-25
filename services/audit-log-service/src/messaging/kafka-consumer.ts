import { Kafka, Consumer, EachMessagePayload, logLevel, LogEntry } from 'kafkajs';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { auditLogService } from '../services/audit-log-service';
import { createLogSchema } from '../validation/schemas';
import { AuditLogEntry } from '../types';
import { getWebSocketHandler } from '../websocket/websocket-handler';

let kafkaConsumer: Consumer | null = null;
let consumerRunPromise: Promise<void> | null = null;

export interface KafkaMessageContext {
    topic: string;
    partition: number;
    offset: string;
    key?: string | null;
}

export async function startKafkaConsumer(): Promise<void> {
    if (!config.kafkaEnabled) {
        logger.info('Kafka consumer is disabled. Set KAFKA_BROKERS to enable ingestion.');
        return;
    }

    if (kafkaConsumer) {
        logger.warn('Attempted to start Kafka consumer, but it is already running.');
        return;
    }

    const kafka = new Kafka({
        clientId: config.kafkaClientId,
        brokers: config.kafkaBrokers,
        logCreator: () => ({ namespace, level, label, log }: LogEntry) => {
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
        },
    });

    kafkaConsumer = kafka.consumer({ groupId: config.kafkaGroupId });

    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe({ topic: config.kafkaTopic, fromBeginning: false });

    kafkaConsumer.on('consumer.crash', (event: { payload?: { error?: Error } }) => {
        const error = event.payload?.error;
        logger.error('Kafka consumer crashed', {
            error: error instanceof Error ? error.message : error,
        });
    });

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

    if (consumerRunPromise) {
        consumerRunPromise.catch((error) => {
            logger.error('Kafka consumer run loop stopped unexpectedly', {
                error: error instanceof Error ? error.message : error,
            });
        });
    }

    logger.info('Kafka consumer started', {
        brokers: config.kafkaBrokers,
        topic: config.kafkaTopic,
        groupId: config.kafkaGroupId,
    });
}

export async function stopKafkaConsumer(): Promise<void> {
    if (!kafkaConsumer) {
        return;
    }

    try {
        await kafkaConsumer.stop();
        await kafkaConsumer.disconnect();
        await consumerRunPromise?.catch(() => undefined);
        logger.info('Kafka consumer stopped');
    } catch (error) {
        logger.warn('Failed to stop Kafka consumer cleanly', {
            error: error instanceof Error ? error.message : error,
        });
    } finally {
        consumerRunPromise = null;
        kafkaConsumer = null;
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
