import { Kafka, logLevel, type Producer } from "kafkajs"
import { config } from "../config/config.js"
import { logger } from "../logger/logger.js"
import type { AuditEvent } from "./events.js"

let kafkaInstance: Kafka | null = null
let producer: Producer | null = null
let connectPromise: Promise<Producer> | null = null

export function isKafkaEnabled(): boolean {
    return config.audit.kafka.enabled && config.audit.kafka.brokers.length > 0
}

function getKafka(): Kafka {
    if (!kafkaInstance) {
        const cfg = config.audit.kafka
        kafkaInstance = new Kafka({
            brokers: cfg.brokers,
            clientId: cfg.clientId,
            connectionTimeout: cfg.connectionTimeoutMs,
            requestTimeout: cfg.requestTimeoutMs,
            retry: { retries: cfg.retries },
            logLevel: logLevel.NOTHING
        })
    }
    return kafkaInstance
}

async function getProducer(): Promise<Producer> {
    if (producer) return producer
    if (!connectPromise) {
        const cfg = config.audit.kafka
        const instance = getKafka().producer({
            allowAutoTopicCreation: false,
            idempotent: cfg.idempotent
        })
        connectPromise = instance
            .connect()
            .then(() => {
                producer = instance
                logger.debug("audit_kafka_connected", { clientId: cfg.clientId, topic: cfg.topic })
                return instance
            })
            .catch(async (err: unknown) => {
                await safeDisconnect(instance)
                connectPromise = null
                throw err
            })
    }
    return connectPromise
}

async function safeDisconnect(instance: Producer): Promise<void> {
    try {
        await instance.disconnect()
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err)
        logger.debug("audit_kafka_disconnect_failed", { error })
    }
}

async function resetProducer(): Promise<void> {
    const current = producer
    producer = null
    const pending = connectPromise
    connectPromise = null
    if (pending) {
        pending.catch(() => undefined)
    }
    if (current) {
        await safeDisconnect(current)
    }
}

export async function publishAuditEvent(event: AuditEvent): Promise<void> {
    if (!isKafkaEnabled()) {
        throw new Error("Kafka publisher disabled")
    }
    const cfg = config.audit.kafka
    const instance = await getProducer()
    try {
        await instance.send({
            topic: cfg.topic,
            acks: cfg.acks,
            timeout: cfg.sendTimeoutMs,
            messages: [
                {
                    key: event.operation_id || event.target?.id || event.actor?.id || undefined,
                    value: JSON.stringify(event),
                    headers: {
                        service: event.service,
                        action: event.action,
                        status: event.status,
                        log_type: event.log_type
                    }
                }
            ]
        })
        logger.debug("audit_kafka_published", { action: event.action, status: event.status })
    } catch (err: unknown) {
        await resetProducer()
        throw err
    }
}
