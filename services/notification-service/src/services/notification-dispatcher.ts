import { v4 as uuidv4 } from "uuid";
import { NotificationChannel, NotificationEvent } from "../types/events";
import { notificationRuleRepository } from "../repositories/notification-rule-repository";
import { templateRepository } from "../repositories/template-repository";
import { inboxRepository } from "../repositories/inbox-repository";
import { emailJobRepository } from "../repositories/email-job-repository";
import { eventLogRepository } from "../repositories/event-log-repository";
import { templateRenderer } from "./template-renderer";
import { userServiceClient } from "../clients/user-service-client";
import { auditClient } from "../clients/audit-client";
import { logger } from "../utils/logger";
import { hashEmail, maskEmail } from "../utils/privacy";

const EMAIL_OVERRIDE_KEYS = ["email", "userEmail", "recipientEmail"];

interface ChannelDispatchFailure {
    channel: NotificationChannel;
    reason: string;
}

export class ChannelDispatchError extends Error {
    constructor(
        public readonly eventId: string,
        public readonly failures: ChannelDispatchFailure[]
    ) {
        super(`Failed to dispatch notification event ${eventId}`);
        this.name = "ChannelDispatchError";
    }
}

export class NotificationDispatcher {
    async dispatch(event: NotificationEvent): Promise<void> {
        const processed = await eventLogRepository.isProcessed(event.eventId);
        if (processed) {
            logger.info("Event already processed, skipping", { eventId: event.eventId });
            return;
        }

        const rule = await notificationRuleRepository.findByEvent(event.eventType);
        if (!rule) {
            logger.warn("No rule configured for event", { eventType: event.eventType });
            await auditClient.recordNotification({
                eventId: event.eventId,
                channel: "routing",
                status: "failed",
                userId: event.userId,
                metadata: {
                    reason: "notification_rule_missing",
                    eventType: event.eventType,
                },
            });
            return;
        }

        const variables = {
            ...event.payload,
            userId: event.userId,
            initiatorId: event.initiatorId,
            eventType: event.eventType,
            source: event.source,
        } as Record<string, unknown>;

        let emailFromPayload: string | null = null;
        for (const key of EMAIL_OVERRIDE_KEYS) {
            const candidate = variables[key];
            if (typeof candidate === "string" && candidate.length > 0) {
                emailFromPayload = candidate;
                break;
            }
        }

        const channelFailures: ChannelDispatchFailure[] = [];

        for (const channel of rule.channels) {
            try {
                const templateKey = rule.templateMappings[channel];
                if (!templateKey) {
                    throw new Error(`Template mapping missing for channel ${channel}`);
                }
                const template = await templateRepository.findByKey(templateKey);
                if (!template) {
                    throw new Error(`Template ${templateKey} missing for channel ${channel}`);
                }

                const renderedBody = templateRenderer.renderHtml(template.body, variables);
                const renderedTitle = template.title
                    ? templateRenderer.renderText(template.title, variables)
                    : "";
                const renderedSubject = template.subject
                    ? templateRenderer.renderText(template.subject, variables)
                    : "";

                if (channel === "in_app") {
                    await this.handleInApp(
                        event,
                        renderedTitle || template.title || "",
                        renderedBody,
                    );
                } else if (channel === "email") {
                    await this.handleEmail(
                        event,
                        renderedSubject || template.subject || "",
                        renderedBody,
                        emailFromPayload,
                    );
                } else {
                    throw new Error(`Unsupported notification channel ${channel}`);
                }
            } catch (error) {
                const reason = error instanceof Error ? error.message : "unknown error";
                channelFailures.push({ channel, reason });
                logger.error("Channel dispatch failed", {
                    channel,
                    eventId: event.eventId,
                    error: reason,
                });
                await auditClient.recordNotification({
                    eventId: event.eventId,
                    channel,
                    status: "failed",
                    userId: event.userId,
                    metadata: {
                        reason,
                        eventType: event.eventType,
                    },
                });
            }
        }

        if (channelFailures.length > 0) {
            throw new ChannelDispatchError(event.eventId, channelFailures);
        }

        await eventLogRepository.markProcessed(event.eventId, event.eventType);
    }

    private async handleInApp(event: NotificationEvent, title: string, body: string): Promise<void> {
        const entryId = uuidv4();
        await inboxRepository.create({
            id: entryId,
            userId: event.userId,
            eventId: event.eventId,
            eventType: event.eventType,
            title: title || "Powiadomienie",
            body,
            metadata: event.payload ? { ...event.payload } : undefined,
        });
        await auditClient.recordNotification({
            eventId: event.eventId,
            channel: "in_app",
            status: "queued",
            userId: event.userId,
            metadata: { eventType: event.eventType },
        });
    }

    private async handleEmail(
        event: NotificationEvent,
        subject: string,
        body: string,
        emailFromPayload: string | null
    ): Promise<void> {
        const recipientEmail = emailFromPayload
            || await userServiceClient.getUserEmail(event.userId);
        if (!recipientEmail) {
            logger.error("Recipient email missing", { eventId: event.eventId, userId: event.userId });
            await auditClient.recordNotification({
                eventId: event.eventId,
                channel: "email",
                status: "failed",
                userId: event.userId,
                metadata: {
                    reason: "recipient_email_missing"
                },
            });
            throw new Error("Recipient email missing");
        }

        await emailJobRepository.enqueue({
            id: uuidv4(),
            eventId: event.eventId,
            userId: event.userId,
            recipientEmail,
            subject: subject || "Powiadomienie",
            body,
        });

        await auditClient.recordNotification({
            eventId: event.eventId,
            channel: "email",
            status: "queued",
            userId: event.userId,
            metadata: {
                recipientEmailHash: hashEmail(recipientEmail),
                recipientEmailMasked: maskEmail(recipientEmail)
            },
        });
    }
}

export const notificationDispatcher = new NotificationDispatcher();
