import { Kafka, logLevel } from "kafkajs";
import { config } from "../config/config";
import { kafkaLogCreator } from "../utils/kafka-logger";
import { logger } from "../utils/logger";
import { emailDeliveryService } from "./email-delivery";

export type DependencyStatus = "up" | "down" | "disabled";

export async function checkKafkaHealth(): Promise<DependencyStatus> {
    if (!config.kafkaBrokers.length) {
        return "disabled";
    }

    const kafka = new Kafka({
        clientId: `${config.kafkaClientId}-health-check`,
        brokers: config.kafkaBrokers,
        logCreator: kafkaLogCreator,
        logLevel: logLevel.NOTHING,
    });

    const admin = kafka.admin();
    try {
        await admin.connect();
        await admin.describeCluster();
        return "up";
    } catch (error) {
        logger.error("Kafka health check failed", {
            error: error instanceof Error ? error.message : "unknown error"
        });
        return "down";
    } finally {
        try {
            await admin.disconnect();
        } catch (disconnectError) {
            logger.warn("Kafka health check disconnect failed", {
                error: disconnectError instanceof Error ? disconnectError.message : "unknown error"
            });
        }
    }
}

export async function checkSmtpHealth(): Promise<DependencyStatus> {
    if (!config.smtpHost) {
        return "disabled";
    }

    try {
        const result = await emailDeliveryService.verifyConnection();
        return result ? "up" : "down";
    } catch (error) {
        logger.error("SMTP health check failed", {
            error: error instanceof Error ? error.message : "unknown error"
        });
        return "down";
    }
}
