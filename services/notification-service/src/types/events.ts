export type NotificationChannel = "in_app" | "email";

export interface NotificationEventPayload {
    [key: string]: unknown;
}

export interface NotificationEvent {
    eventId: string;
    eventType:
        | "AUDIT_SECURITY_EVENT_DETECTED"
        | "ROLE_ASSIGNED"
        | "ROLE_REVOKED"
        | "MEDIA_APPROVED"
        | "MEDIA_REJECTED"
        | "MEDIA_FLAGGED_NSFW"
        | "MEDIA_CENSORED"
        | "MEDIA_DELETED_SYSTEM"
        | "MEDIA_STORAGE_THRESHOLD"
        | "USER_REGISTERED"
        | "USER_PASSWORD_RESET_REQUESTED"
        | "USER_BANNED"
        | "USER_UNBANNED";
    userId: string;
    initiatorId?: string | null;
    payload?: NotificationEventPayload;
    source: string;
}

export interface NotificationRule {
    id: string;
    eventType: NotificationEvent["eventType"];
    audience: "user" | "admin";
    channels: NotificationChannel[];
    templateMappings: Record<NotificationChannel, string>;
    isActive: boolean;
}

export interface NotificationTemplate {
    id: string;
    templateKey: string;
    eventType: NotificationEvent["eventType"];
    channel: NotificationChannel;
    title?: string | null;
    subject?: string | null;
    body: string;
}

export interface InboxNotification {
    id: string;
    userId: string;
    eventId: string;
    eventType: NotificationEvent["eventType"];
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    isRead: boolean;
    readAt?: Date | null;
    createdAt: Date;
}

export interface EmailJob {
    id: string;
    eventId: string;
    userId?: string;
    recipientEmail: string;
    subject: string;
    body: string;
    status: "pending" | "processing" | "sent" | "failed" | "dead";
    retryCount: number;
    nextRetryAt: Date | null;
    lastError?: string | null;
    createdAt: Date;
    updatedAt: Date;
}
