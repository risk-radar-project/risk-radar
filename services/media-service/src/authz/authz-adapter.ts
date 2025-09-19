import axios from 'axios';
import { config } from '../config/config.js';
import { CircuitBreaker, registerBreaker, getBreaker } from '../domain/circuit-breaker.js';
import { logger } from '../logger/logger.js';
import { errors } from '../errors/http-error.js';

/** Lazily create or fetch circuit breaker for authz service calls. */
function ensureBreaker(): CircuitBreaker {
    let b = getBreaker('authz');
    if (!b) {
        b = new CircuitBreaker({
            name: 'authz',
            failureThreshold: config.authz.breaker.failureThreshold,
            halfOpenAfterMs: config.authz.breaker.halfOpenAfterMs,
            resetAfterMs: config.authz.breaker.halfOpenAfterMs,
        });
        registerBreaker(b);
        logger.debug('breaker_registered', { name: 'authz' });
    }
    return b;
}

/** Check if a user holds a specific permission (propagates via X-User-ID). */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
    if (!userId) return false; // deny by default
    const breaker = ensureBreaker();
    const url = `${config.authz.baseUrl}/has-permission`;
    try {
        return await breaker.exec(async () => {
            for (let attempt = 0; attempt <= config.authz.retries; attempt++) {
                try {
                    const res = await axios.get(url, { params: { permission }, headers: { 'X-User-ID': userId }, timeout: config.authz.timeoutMs });
                    return Boolean(res.data?.has_permission);
                } catch (e) {
                    if (attempt === config.authz.retries) throw e;
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
                }
            }
            return false;
        });
    } catch (e) {
        const err = e as any;
        logger.warn('Authz check failed', { error: err?.message || String(err) });
        throw errors.dependencyUnavailable('authz');
    }
}

// Eager init to ensure breaker registered at startup
ensureBreaker();
