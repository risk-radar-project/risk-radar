export type BootstrapState = 'initializing' | 'connecting' | 'migrating' | 'ready' | 'failed';

let state: BootstrapState = 'initializing';
let errorMessage: string | null = null;
let attempts = 0;

export function setBootstrapState(next: BootstrapState, opts?: { error?: string | null; attempt?: number }) {
    state = next;
    if (opts?.error !== undefined) errorMessage = opts.error;
    if (opts?.attempt !== undefined) attempts = opts.attempt;
}

export function getBootstrapInfo() {
    return { state, error: errorMessage, attempts };
}
