import { NotificationChannel, NotificationEvent } from "../types/events";

export interface RuleDefinition {
    eventType: NotificationEvent["eventType"];
    audience: "user" | "admin";
    channels: NotificationChannel[];
    templateMappings: Partial<Record<NotificationChannel, string>>;
}

export const ruleDefinitions: RuleDefinition[] = [
    {
        eventType: "AUDIT_SECURITY_EVENT_DETECTED",
        audience: "admin",
        channels: ["in_app", "email"],
        templateMappings: {
            in_app: "AUDIT_SECURITY_EVENT_DETECTED_IN_APP",
            email: "AUDIT_SECURITY_EVENT_DETECTED_EMAIL"
        }
    },
    {
        eventType: "ROLE_ASSIGNED",
        audience: "user",
        channels: ["in_app", "email"],
        templateMappings: {
            in_app: "ROLE_ASSIGNED_IN_APP",
            email: "ROLE_ASSIGNED_EMAIL"
        }
    },
    {
        eventType: "ROLE_REVOKED",
        audience: "user",
        channels: ["in_app"],
        templateMappings: {
            in_app: "ROLE_REVOKED_IN_APP"
        }
    },
    {
        eventType: "MEDIA_APPROVED",
        audience: "user",
        channels: ["in_app"],
        templateMappings: {
            in_app: "MEDIA_APPROVED_IN_APP"
        }
    },
    {
        eventType: "MEDIA_REJECTED",
        audience: "user",
        channels: ["in_app", "email"],
        templateMappings: {
            in_app: "MEDIA_REJECTED_IN_APP",
            email: "MEDIA_REJECTED_EMAIL"
        }
    },
    {
        eventType: "MEDIA_FLAGGED_NSFW",
        audience: "user",
        channels: ["in_app", "email"],
        templateMappings: {
            in_app: "MEDIA_FLAGGED_NSFW_IN_APP",
            email: "MEDIA_FLAGGED_NSFW_EMAIL"
        }
    },
    {
        eventType: "MEDIA_CENSORED",
        audience: "user",
        channels: ["in_app"],
        templateMappings: {
            in_app: "MEDIA_CENSORED_IN_APP"
        }
    },
    {
        eventType: "MEDIA_DELETED_SYSTEM",
        audience: "user",
        channels: ["in_app"],
        templateMappings: {
            in_app: "MEDIA_DELETED_SYSTEM_IN_APP"
        }
    },
    {
        eventType: "MEDIA_STORAGE_THRESHOLD",
        audience: "admin",
        channels: ["in_app", "email"],
        templateMappings: {
            in_app: "MEDIA_STORAGE_THRESHOLD_IN_APP",
            email: "MEDIA_STORAGE_THRESHOLD_EMAIL"
        }
    },
    {
        eventType: "USER_REGISTERED",
        audience: "user",
        channels: ["in_app", "email"],
        templateMappings: {
            in_app: "USER_REGISTERED_IN_APP",
            email: "USER_REGISTERED_EMAIL"
        }
    },
    {
        eventType: "PASSWORD_CHANGED",
        audience: "user",
        channels: ["email"],
        templateMappings: {
            email: "PASSWORD_CHANGED_EMAIL"
        }
    },
    {
        eventType: "USER_PASSWORD_RESET_REQUESTED",
        audience: "user",
        channels: ["email"],
        templateMappings: {
            email: "USER_PASSWORD_RESET_REQUESTED_EMAIL"
        }
    },
    {
        eventType: "USER_BANNED",
        audience: "user",
        channels: ["in_app", "email"],
        templateMappings: {
            email: "USER_BANNED_EMAIL",
            in_app: "USER_BANNED_IN_APP"
        }
    },
    {
        eventType: "USER_UNBANNED",
        audience: "user",
        channels: ["in_app", "email"],
        templateMappings: {
            in_app: "USER_UNBANNED_IN_APP",
            email: "USER_UNBANNED_EMAIL"
        }
    },
    {
        eventType: "REPORT_CREATED",
        audience: "user",
        channels: ["email"],
        templateMappings: {
            email: "REPORT_CREATED_EMAIL"
        }
    },
    {
        eventType: "REPORT_STATUS_CHANGED",
        audience: "user",
        channels: ["in_app", "email"],
        templateMappings: {
            in_app: "REPORT_STATUS_CHANGED_IN_APP",
            email: "REPORT_STATUS_CHANGED_EMAIL"
        }
    },
    {
        eventType: "REPORT_AI_VERIFIED",
        audience: "user",
        channels: ["in_app"],
        templateMappings: {
            in_app: "REPORT_AI_VERIFIED_IN_APP"
        }
    },
    {
        eventType: "REPORT_AI_FLAGGED",
        audience: "user",
        channels: ["in_app"],
        templateMappings: {
            in_app: "REPORT_AI_FLAGGED_IN_APP"
        }
    }
];
