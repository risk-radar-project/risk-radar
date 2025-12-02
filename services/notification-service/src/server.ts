import { Server } from "http";
import { createApp } from "./app";
import { config } from "./config/config";
import { logger } from "./utils/logger";
import { database } from "./database/database";
import { notificationConsumer } from "./services/notification-consumer";
import { emailScheduler } from "./services/email-scheduler";
import { runMigrations } from "./database/migrate";
import { runSeeder } from "./database/seed";

const app = createApp();
let server: Server | null = null;

async function bootstrap(): Promise<void> {
    await database.waitForConnection();
    await runMigrations();
    await runSeeder();
    emailScheduler.start();
    await notificationConsumer.start();
    const kafkaRuntime = notificationConsumer.getRuntimeStatus();
    if (kafkaRuntime.mode !== "connected") {
        logger.warn("Kafka unavailable at startup; HTTP fallback active while retrying connection", {
            kafkaMode: kafkaRuntime.mode,
            lastError: kafkaRuntime.lastError
        });
    }
}

async function start(): Promise<void> {
    try {
        await bootstrap();
        server = app.listen(config.port, () => {
            logger.info(`Notification service listening on port ${config.port}`);
        });
    } catch (error) {
        logger.error("Failed to bootstrap service", { error });
        process.exit(1);
    }
}

void start();

async function shutdown(): Promise<void> {
    logger.info("Shutting down notification service");
    emailScheduler.stop();
    await notificationConsumer.stop();
    if (server) {
        server.close(() => {
            logger.info("HTTP server closed");
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
