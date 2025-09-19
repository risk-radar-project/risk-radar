import axios from 'axios';
import { config } from '../config/config.js';
import { AuditEvent } from './events.js';
import { CircuitBreaker, registerBreaker, getBreaker } from '../domain/circuit-breaker.js';
import { logger } from '../logger/logger.js';

// Lazy breaker registration
function ensureBreaker(): CircuitBreaker {
    let b = getBreaker('audit');
    if (!b) {
        b = new CircuitBreaker({
            name: 'audit',
            failureThreshold: config.audit.breaker.failureThreshold,
            halfOpenAfterMs: config.audit.breaker.halfOpenAfterMs,
            resetAfterMs: config.audit.breaker.halfOpenAfterMs,
        });
        registerBreaker(b);
        logger.debug('breaker_registered', { name: 'audit' });
    }
    return b;
}

export async function emitAudit(event: AuditEvent): Promise<void> {
    const breaker = ensureBreaker();
    const url = `${config.audit.baseUrl}/logs`;
    try {
        await breaker.exec(async () => {
            for (let attempt = 0; attempt <= config.audit.retries; attempt++) {
                try {
                    const body: any = {
                        service: event.service,
                        action: event.action,
                        actor: event.actor,
                        target: event.target,
                        status: event.status,
                        log_type: event.log_type,
                        metadata: event.metadata,
                    };
                    if ((event as any).operation_id) body.operation_id = (event as any).operation_id;
                    await axios.post(url, body, { timeout: config.audit.timeoutMs });
                    return; // success
                } catch (e) {
                    if (attempt === config.audit.retries) throw e;
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
                }
            }
        });
    } catch (e) {
        // If breaker open or all attempts failed: log only
        const err = e as any;
        logger.warn('Audit emit failed', { error: err?.message || String(err) });
    }
}

// Eager init for breaker registration at startup
ensureBreaker();
