import 'dotenv/config';
import { createServer } from 'http';
import app from './app.js';
import { config } from './config/config.js';
import { logger } from './logger/logger.js';
import { runMigrations } from './db/migrate.js';
import { gc } from './domain/gc.js';
import { db } from './db/pool.js';

const port = config.httpPort;
const server = createServer(app);

runMigrations()
    .then(() => {
        server.listen(port, () => {
            logger.info('Media Service started', { port });
            gc.start();
        });
    })
    .catch((e) => {
        const err = e as any;
        logger.error('Migration failed', { error: err?.message ? String(err.message) : String(err), stack: err?.stack });
        process.exit(1);
    });

const shutdown = (signal: string) => {
    logger.warn('Shutdown signal received', { signal });
    gc.stop();
    server.close(async () => {
        logger.info('HTTP server closed');
        try {
            await db.close();
            logger.info('DB pool closed');
        } catch (e) {
            const err = e as any;
            logger.warn('DB close failed', { error: err?.message || String(err) });
        }
        process.exit(0);
    });
    // Force exit after timeout
    setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
