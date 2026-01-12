import axios, { AxiosInstance } from "axios";
import { config } from "../config/config";
import { logger } from "../utils/logger";
import { publishAuditLog } from "../audit/audit-kafka-producer";

interface NotificationAuditPayload {
    eventId: string;
    channel: string;
    status: "queued" | "sent" | "failed" | "skipped";
    userId?: string;
    metadata?: Record<string, unknown>;
}

interface AuditUserActionPayload {
    action: string;
    actorId: string;
    targetId?: string;
    targetType?: string;
    metadata?: Record<string, unknown>;
    status?: "success" | "error";
    operationId?: string;
}

interface AuditBodyInput {
    action: string;
    actorId: string;
    actorType: "user" | "service";
    target?: { id: string; type: string } | undefined;
    status: "success" | "error";
    logType: "ACTION" | "ERROR";
    operationId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}

class AuditClient {
    private http: AxiosInstance;

    constructor() {
        this.http = axios.create({
            baseURL: config.auditServiceBaseUrl,
            timeout: 5000,
        });
    }

    async recordNotification(payload: NotificationAuditPayload): Promise<void> {
        const target = payload.userId ? { id: payload.userId, type: "user" } : undefined;
        const bodyInput: AuditBodyInput = {
            action: `notification.${payload.channel}.${payload.status}`,
            actorId: payload.userId || "notification-service",
            actorType: payload.userId ? "user" : "service",
            status: payload.status === "failed" ? "error" : "success",
            logType: payload.status === "failed" ? "ERROR" : "ACTION",
            operationId: payload.eventId,
            metadata: payload.metadata,
        };

        if (target) {
            bodyInput.target = target;
        }

        const body = this.buildAuditBody(bodyInput);

        await this.publishAuditLog(body, payload.eventId);
    }

    async recordUserAction(payload: AuditUserActionPayload): Promise<void> {
        const status = payload.status ?? "success";
        const target = payload.targetId ? { id: payload.targetId, type: payload.targetType ?? "notification" } : undefined;
        const bodyInput: AuditBodyInput = {
            action: payload.action,
            actorId: payload.actorId,
            actorType: "user",
            status,
            logType: status === "error" ? "ERROR" : "ACTION",
            operationId: payload.operationId,
            metadata: payload.metadata,
        };

        if (target) {
            bodyInput.target = target;
        }

        const body = this.buildAuditBody(bodyInput);

        await this.publishAuditLog(body, payload.operationId);
    }

    private async publishAuditLog(body: Record<string, unknown>, operationId?: string): Promise<void> {

        if (config.auditKafka.enabled && config.auditKafka.brokers.length > 0) {
            try {
                await publishAuditLog(body);
                return;
            } catch (error) {
                logger.warn("Audit Kafka publish failed, falling back to HTTP", {
                    operationId,
                    error: error instanceof Error ? error.message : "unknown error"
                });
            }
        }

        try {
            await this.sendViaHttp(body);
        } catch (error) {
            logger.error("Failed to send audit log via HTTP fallback", {
                operationId,
                error: error instanceof Error ? error.message : "unknown error"
            });
        }
    }

    private buildAuditBody(payload: AuditBodyInput): Record<string, unknown> {
        return {
            service: "notification-service",
            action: payload.action,
            actor: {
                id: payload.actorId,
                type: payload.actorType
            },
            target: payload.target,
            status: payload.status,
            log_type: payload.logType,
            operation_id: payload.operationId,
            metadata: payload.metadata || {},
        };
    }

    private async sendViaHttp(body: Record<string, unknown>): Promise<void> {
        const maxAttempts = Math.max(config.auditHttpRetries, 0) + 1;
        const baseDelayMs = 200;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.http.post("/logs", body, { timeout: config.auditHttpTimeoutMs });
                return;
            } catch (error) {
                lastError = error;
                logger.warn("Audit HTTP attempt failed", {
                    attempt,
                    maxAttempts,
                    error: error instanceof Error ? error.message : "unknown error"
                });

                if (attempt === maxAttempts) {
                    break;
                }

                const delay = baseDelayMs * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        throw lastError instanceof Error ? lastError : new Error("Audit HTTP fallback exhausted");
    }
}

export const auditClient = new AuditClient();
