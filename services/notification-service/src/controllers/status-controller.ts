import { Request, Response } from "express";
import { database } from "../database/database";
import { checkKafkaHealth, checkSmtpHealth, DependencyStatus } from "../services/health-checks";
import { notificationConsumer } from "../services/notification-consumer";

export async function getStatus(_req: Request, res: Response): Promise<void> {
    const [databaseHealthy, kafkaStatus, smtpStatus] = await Promise.all([
        database.healthCheck(),
        checkKafkaHealth(),
        checkSmtpHealth()
    ]);

    const kafkaRuntime = notificationConsumer.getRuntimeStatus();

    const overallHealthy = databaseHealthy
        && isStatusUp(kafkaStatus)
        && isStatusUp(smtpStatus);

    res.json({
        status: overallHealthy ? "ok" : "degraded",
        services: {
            database: databaseHealthy ? "up" : "down",
            kafka: {
                status: kafkaStatus,
                mode: kafkaRuntime.mode,
                connected: kafkaRuntime.connected,
                reconnecting: kafkaRuntime.reconnecting,
                brokersConfigured: kafkaRuntime.brokersConfigured,
                lastError: kafkaRuntime.lastError ?? null,
                lastFailureAt: kafkaRuntime.lastFailureAt ?? null
            },
            smtp: smtpStatus,
        },
        timestamp: new Date().toISOString(),
    });
}

function isStatusUp(status: DependencyStatus): boolean {
    return status === "up" || status === "disabled";
}
