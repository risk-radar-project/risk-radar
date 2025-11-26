import { Consumer, Kafka, KafkaMessage } from "kafkajs";
import Joi from "joi";
import { config } from "../config/config";
import { logger } from "../utils/logger";
import { notificationDispatcher } from "./notification-dispatcher";
import { NotificationEvent } from "../types/events";
import { kafkaLogCreator } from "../utils/kafka-logger";

const eventSchema = Joi.object<NotificationEvent>(
    {
        eventId: Joi.string().guid({ version: "uuidv4" }).required(),
        eventType: Joi.string().required(),
        userId: Joi.string().required(),
        initiatorId: Joi.string().optional().allow(null),
        payload: Joi.object().optional(),
        source: Joi.string().required(),
    }
);

export class NotificationConsumer {
    private kafka: Kafka | null = null;
    private running = false;
    private consumer: Consumer | null = null;
    private reconnecting = false;
    private stopped = false;
    private disabled = false;

    async start(): Promise<void> {
        if (this.running) {
            return;
        }
        if (!config.kafkaBrokers.length) {
            if (!this.disabled) {
                const message = "Kafka brokers not configured. Notification consumer disabled; "
                    + "service will rely solely on the fallback endpoint.";
                logger.warn(message);
            }
            this.disabled = true;
            this.running = false;
            return;
        }
        this.disabled = false;
        this.stopped = false;
        await this.connectWithRetry(true);
    }

    async stop(): Promise<void> {
        if (this.disabled) {
            return;
        }
        this.stopped = true;
        this.running = false;
        this.reconnecting = false;
        await this.cleanupConsumer();
    }

    private async connectWithRetry(failIfExhausted: boolean): Promise<void> {
        let attempt = 0;
        let delayMs = Math.max(1, config.kafkaConnectRetryInitialDelayMs);
        const maxAttempts = failIfExhausted ? config.kafkaConnectRetryAttempts : Number.POSITIVE_INFINITY;

        while (!this.stopped && attempt < maxAttempts) {
            attempt += 1;
            try {
                await this.initializeConsumer();
                this.running = true;
                logger.debug("Kafka consumer started", { topic: config.kafkaTopic, attempt });
                return;
            } catch (error) {
                const message = error instanceof Error ? error.message : "unknown error";
                logger.error("Kafka consumer connection failed", {
                    attempt,
                    maxAttempts: failIfExhausted ? config.kafkaConnectRetryAttempts : "unbounded",
                    error: message,
                });
                await this.cleanupConsumer();
                if (this.stopped) {
                    break;
                }
                if (attempt >= maxAttempts) {
                    throw error instanceof Error ? error : new Error(message);
                }
                await this.delay(delayMs);
                delayMs = Math.min(delayMs * 2, config.kafkaConnectRetryMaxDelayMs);
            }
        }

        if (failIfExhausted) {
            throw new Error("Kafka consumer failed to start after configured retries");
        }
    }

    private async initializeConsumer(): Promise<void> {
        this.kafka = new Kafka({
            clientId: config.kafkaClientId,
            brokers: config.kafkaBrokers,
            logCreator: kafkaLogCreator,
        });

        this.consumer = this.kafka.consumer({ groupId: config.kafkaGroupId });
        await this.consumer.connect();
        await this.consumer.subscribe({ topic: config.kafkaTopic, fromBeginning: false });

        void this.consumer.run({
            eachMessage: async ({ message }: { message: KafkaMessage }) => {
                const event = this.parseMessage(message);
                if (!event) {
                    return;
                }
                try {
                    await notificationDispatcher.dispatch(event);
                } catch (error) {
                    const reason = error instanceof Error ? error : new Error("unknown error");
                    logger.error("Failed to process event", {
                        eventId: event.eventId,
                        error: reason.message
                    });
                    throw reason;
                }
            }
        }).catch(async (error) => {
            if (this.stopped) {
                return;
            }
            const message = error instanceof Error ? error.message : "unknown error";
            logger.error("Kafka consumer stopped unexpectedly", { error: message });
            this.running = false;
            if (this.reconnecting) {
                return;
            }
            this.reconnecting = true;
            await this.cleanupConsumer();
            try {
                await this.connectWithRetry(false);
            } catch (reconnectError) {
                logger.error("Kafka consumer reconnection failed", {
                    error: reconnectError instanceof Error ? reconnectError.message : "unknown error"
                });
                process.exit(1);
            } finally {
                this.reconnecting = false;
            }
        });
    }

    private async cleanupConsumer(): Promise<void> {
        if (this.consumer) {
            try {
                await this.consumer.disconnect();
            } catch (error) {
                logger.warn("Kafka consumer disconnect failed", {
                    error: error instanceof Error ? error.message : "unknown error"
                });
            }
        }
        this.consumer = null;
        this.kafka = null;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private parseMessage(message: KafkaMessage): NotificationEvent | null {
        if (!message.value) {
            logger.warn("Kafka message without payload");
            return null;
        }
        try {
            const parsed = JSON.parse(message.value.toString());
            const { error, value } = eventSchema.validate(parsed, { allowUnknown: true });
            if (error) {
                logger.error("Invalid event payload", { error: error.message });
                return null;
            }
            return value as NotificationEvent;
        } catch (error) {
            logger.error("Failed to parse Kafka message", {
                error: error instanceof Error ? error.message : "unknown error"
            });
            return null;
        }
    }
}

export const notificationConsumer = new NotificationConsumer();
