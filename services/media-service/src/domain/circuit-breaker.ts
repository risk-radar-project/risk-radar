export type BreakerState = 'closed' | 'open' | 'half_open';

interface Options {
    failureThreshold: number; // consecutive failures before opening
    halfOpenAfterMs: number;  // time window after which we allow a trial call (half-open)
    resetAfterMs: number;     // optional max open time before forcing half-open (fallback to halfOpenAfterMs)
    name: string;
}

export interface BreakerSnapshot {
    name: string;
    state: BreakerState;
    consecutiveFailures: number;
    openedAt: number | null;
    lastFailureAt: number | null;
}

export class CircuitBreaker {
    private state: BreakerState = 'closed';
    private consecutiveFailures = 0;
    private openedAt: number | null = null;
    private lastFailureAt: number | null = null;

    constructor(private readonly opts: Options) { }

    /** Execute a function under breaker protection. */
    async exec<T>(fn: () => Promise<T>): Promise<T> {
        const now = Date.now();
        if (this.state === 'open') {
            // Allow a test request once cool-down elapsed.
            if (this.openedAt && (now - this.openedAt) >= this.opts.halfOpenAfterMs) {
                this.state = 'half_open';
            } else {
                throw new Error(`circuit_open:${this.opts.name}`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (e) {
            this.onFailure();
            throw e;
        }
    }

    private onSuccess() {
        this.consecutiveFailures = 0;
        if (this.state !== 'closed') {
            this.state = 'closed';
            this.openedAt = null;
        }
    }

    private onFailure() {
        this.lastFailureAt = Date.now();
        this.consecutiveFailures += 1;
        if (this.state === 'half_open') {
            // Failure during probe keeps breaker open.
            this.trip();
            return;
        }
        if (this.state === 'closed' && this.consecutiveFailures >= this.opts.failureThreshold) {
            this.trip();
        }
    }

    private trip() {
        this.state = 'open';
        this.openedAt = Date.now();
    }

    snapshot(): BreakerSnapshot {
        return {
            name: this.opts.name,
            state: this.state,
            consecutiveFailures: this.consecutiveFailures,
            openedAt: this.openedAt,
            lastFailureAt: this.lastFailureAt,
        };
    }
}

// Simple in-memory registry (optional usage)
const breakers: Record<string, CircuitBreaker> = {};

/** Register a breaker instance globally (by its name). */
export function registerBreaker(b: CircuitBreaker) {
    breakers[b['snapshot']().name] = b;
}

/** Fetch a previously registered breaker. */
export function getBreaker(name: string): CircuitBreaker | undefined {
    return breakers[name];
}

/** Snapshot all registered breakers. */
export function breakersStatus(): BreakerSnapshot[] {
    return Object.values(breakers).map(b => b.snapshot());
}