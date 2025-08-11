import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/config';
import { logger } from './utils/logger';
import { runMigrations } from './database/migrate';
import { initializeWebSocket, getWebSocketHandler } from './websocket/websocket-handler';
import { retentionScheduler } from './services/retention-scheduler';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import auditRoutes from './routes/audit-routes';
import healthRoutes from './routes/health-routes';
import { requestLogger } from './middleware/request-logger';

class AuditLogServer {
    private app: express.Application;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private server: any;

    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    private setupMiddleware(): void {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use(requestLogger);
    }

    private setupRoutes(): void {
        this.app.use('/', auditRoutes);
        this.app.use('/', healthRoutes);
    }

    private setupErrorHandling(): void {
        this.app.use(notFoundHandler);
        this.app.use(errorHandler);
    }

    async start(): Promise<void> {
        try {
            logger.info('Starting Audit Log Service...');

            // Wait for database connection and run migrations
            logger.info('Connecting to database...');
            await runMigrations();

            // Create HTTP server
            this.server = createServer(this.app);

            // Initialize WebSocket if enabled
            if (config.websocketEnabled) {
                initializeWebSocket(this.server);
                logger.info('WebSocket server initialized');
            }

            // Start retention scheduler
            retentionScheduler.start();
            logger.info('Retention scheduler started');

            // Start listening
            await new Promise<void>((resolve, reject) => {
                this.server.listen(config.port, (error?: Error) => {
                    if (error) {
                        reject(error);
                    } else {
                        const wsState = config.websocketEnabled ? 'enabled' : 'disabled';
                        logger.info(
                            `Audit Log Service started successfully on port :${config.port} ` +
                            `in ${config.nodeEnv} environment. WebSocket is ${wsState}`
                        );
                        resolve();
                    }
                });
            });

        } catch (error) {
            logger.error('Failed to start server', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        logger.info('Stopping Audit Log Service...');

        // Stop retention scheduler
        retentionScheduler.stop();
        logger.info('Retention scheduler stopped');

        // Close WebSocket server if initialized
        try {
            const ws = getWebSocketHandler();
            if (ws) {
                await ws.close();
                logger.info('WebSocket server stopped');
            }
        } catch (error) {
            logger.warn('Error closing WebSocket server', error);
        }

        // Close HTTP server
        if (this.server) {
            await new Promise<void>((resolve) => {
                this.server.close(() => {
                    logger.info('HTTP server stopped');
                    resolve();
                });
            });
        }

        // Close database connections
        try {
            const { database } = await import('./database/database');
            await database.close();
            logger.info('Database connections closed');
        } catch (error) {
            logger.warn('Error closing database connections', error);
        }

        logger.info('Audit Log Service stopped gracefully');
    }
}

// Start server if this file is executed directly
if (require.main === module) {
    const server = new AuditLogServer();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down gracefully');
        await server.stop();
        process.exit(0);
    });

    server.start().catch((error) => {
        logger.error('Failed to start server', error);
        process.exit(1);
    });
}

export default AuditLogServer;
