import { Kafka, logLevel, Producer } from "kafkajs";
import { config } from "../config/config";
import { logger } from "../utils/logger";

let producer: Producer | null = null;

function isKafkaConfigured(): boolean {
    return config.auditKafka.enabled && config.auditKafka.brokers.length > 0;
}

async function getProducer(): Promise<Producer> {
    if (!producer) {
        const kafka = new Kafka({
            clientId: config.auditKafka.clientId,
            brokers: config.auditKafka.brokers,
            connectionTimeout: config.auditKafka.connectionTimeoutMs,
            requestTimeout: config.auditKafka.requestTimeoutMs,
            logLevel: logLevel.NOTHING,
        });
        producer = kafka.producer({
            allowAutoTopicCreation: false,
            idempotent: config.auditKafka.idempotent,
        });
        await producer.connect();
        logger.info("Audit Kafka producer connected", {
            clientId: config.auditKafka.clientId,
            topic: config.auditKafka.topic,
        });
    }
    return producer;
}

export async function publishAuditLog(body: Record<string, unknown>): Promise<void> {
    if (!isKafkaConfigured()) {
        throw new Error("Audit Kafka not configured");
    }

    const instance = await getProducer();
    await instance.send({
        topic: config.auditKafka.topic,
        acks: config.auditKafka.acks,
        timeout: config.auditKafka.sendTimeoutMs,
        messages: [
            {
                key: typeof body.operation_id === "string" ? body.operation_id : null,
                value: JSON.stringify(body),
            },
        ],
    });
}

export async function disconnectAuditProducer(): Promise<void> {
    if (!producer) {
        return;
    }
    try {
        await producer.disconnect();
    } catch (error) {
        logger.warn("Audit Kafka producer disconnect failed", {
            error: error instanceof Error ? error.message : "unknown error",
        });
    } finally {
        producer = null;
    }
}
