import axios from "axios"
import { config } from "../config/config.js"
import { AuditEvent } from "./events.js"
import { CircuitBreaker, registerBreaker, getBreaker } from "../domain/circuit-breaker.js"
import { logger } from "../logger/logger.js"
import { isKafkaEnabled, publishAuditEvent } from "./kafka-publisher.js"

// Lazy breaker registration
function ensureBreaker(): CircuitBreaker {
    let b = getBreaker("audit")
    if (!b) {
        b = new CircuitBreaker({
            name: "audit",
            failureThreshold: config.audit.breaker.failureThreshold,
            halfOpenAfterMs: config.audit.breaker.halfOpenAfterMs,
            resetAfterMs: config.audit.breaker.halfOpenAfterMs
        })
        registerBreaker(b)
        logger.debug("breaker_registered", { name: "audit" })
    }
    return b
}

export async function emitAudit(event: AuditEvent): Promise<void> {
    if (isKafkaEnabled()) {
        try {
            await publishAuditEvent(event)
            return
        } catch (err: unknown) {
            const error = err instanceof Error ? err.message : String(err)
            logger.warn("audit_kafka_publish_failed", { error, fallback: "http" })
        }
    }

    const breaker = ensureBreaker()
    const url = `${config.audit.baseUrl}/logs`
    try {
        await sendViaHttp(event, breaker, url)
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err)
        logger.warn("audit_http_fallback_failed", { error })
    }
}

// Eager init for breaker registration at startup
ensureBreaker()

async function sendViaHttp(event: AuditEvent, breaker: CircuitBreaker, url: string): Promise<void> {
    const body = toHttpPayload(event)
    await breaker.exec(async () => {
        for (let attempt = 0; attempt <= config.audit.retries; attempt++) {
            try {
                console.log("TRYING TO SEND AUDIT VIA HTTP...", body)
                // await axios.post(url, body, { timeout: config.audit.timeoutMs })
                return
            } catch (err: unknown) {
                if (attempt === config.audit.retries) throw err
                const backoffMs = Math.pow(2, attempt) * 100
                // Exponential backoff before retrying HTTP fallback.
                await new Promise(resolve => setTimeout(resolve, backoffMs))
            }
        }
    })
}

const toHttpPayload = (event: AuditEvent) => {
    const payload: Record<string, unknown> = {
        service: event.service,
        action: event.action,
        actor: event.actor,
        target: event.target,
        status: event.status,
        log_type: event.log_type,
        metadata: event.metadata
    }
    if (event.operation_id) payload.operation_id = event.operation_id
    return payload
}
