import { db } from '../db/pool.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { deleteFiles } from '../storage/fs-storage.js';

let timer: NodeJS.Timeout | null = null;
let running = false;

/** Start the repeating GC loop (idempotent). */
export function startGC() {
    if (!config.gc.enabled) {
        logger.info('GC disabled');
        return;
    }
    if (timer) return;
    logger.debug('Starting GC loop', { intervalMs: config.gc.intervalMs, deleteAfterDays: config.gc.deleteAfterDays });
    timer = setInterval(runOnce, config.gc.intervalMs).unref();
}

/** Stop the loop if running. */
export async function stopGC() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

/** Run a single GC iteration (safe to call concurrently; overlaps skipped). */
async function runOnce() {
    if (running) return; // skip overlapping
    running = true;
    try {
        const days = config.gc.deleteAfterDays;
        // 1. Hard delete logically deleted older than retention
        const qDeleted = await db.query<{ id: string }>(
            `SELECT id FROM media_assets WHERE deleted=true AND deleted_at < now() - ($1::int * INTERVAL '1 day') LIMIT ${config.gc.batchLimit}`,
            [days]
        );
        for (const r of qDeleted.rows) {
            try {
                await deleteFiles(config.mediaRoot, r.id);
                await db.query('DELETE FROM media_assets WHERE id=$1', [r.id]);
                logger.info('GC purged media', { id: r.id });
            } catch (e) {
                const err = e as any;
                logger.warn('GC purge failed', { id: r.id, error: err?.message || String(err) });
            }
        }

        // 2. Expire temporary media (not yet explicitly kept or rejected) past expires_at
        const qTemp = await db.query<{ id: string }>(
            `SELECT id FROM media_assets WHERE is_temporary=true AND expires_at IS NOT NULL AND expires_at < now() LIMIT ${config.gc.batchLimit}`
        );
        for (const r of qTemp.rows) {
            try {
                await deleteFiles(config.mediaRoot, r.id);
                await db.query('DELETE FROM media_assets WHERE id=$1', [r.id]);
                logger.info('GC expired temporary media', { id: r.id });
            } catch (e) {
                const err = e as any;
                logger.warn('GC expire temp failed', { id: r.id, error: err?.message || String(err) });
            }
        }
    } catch (e) {
        const err = e as any;
        logger.warn('GC iteration error', { error: err?.message || String(err) });
    } finally {
        running = false;
    }
}

export const gc = { start: startGC, stop: stopGC, runOnce };