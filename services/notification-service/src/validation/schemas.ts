import Joi from "joi";

const eventTypes = [
    "AUDIT_SECURITY_EVENT_DETECTED",
    "ROLE_ASSIGNED",
    "ROLE_REVOKED",
    "MEDIA_APPROVED",
    "MEDIA_REJECTED",
    "MEDIA_FLAGGED_NSFW",
    "MEDIA_CENSORED",
    "MEDIA_DELETED_SYSTEM",
    "MEDIA_STORAGE_THRESHOLD",
    "USER_REGISTERED",
    "USER_PASSWORD_RESET_REQUESTED",
    "PASSWORD_CHANGED",
    "USER_BANNED",
    "USER_UNBANNED",
    "REPORT_CREATED",
    "REPORT_STATUS_CHANGED",
    "REPORT_AI_VERIFIED",
    "REPORT_AI_FLAGGED",
    "REPORT_CATEGORIZED",
    "FAKE_REPORT_DETECTED",
    "SUSPICIOUS_REPORT_DETECTED"
] as const;

const genericPayloadSchema = Joi.object().unknown(true);

const passwordResetPayloadSchema = Joi.object({
    resetUrl: Joi.string()
        .uri({ scheme: ["http", "https"] })
        .messages({ "string.uri": '"payload.resetUrl" must be a valid http(s) URL' })
        .required()
}).unknown(true);

export const listNotificationsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    isRead: Joi.string().valid("true", "false").optional(),
});

export const notificationIdParamsSchema = Joi.object({
    id: Joi.string()
        .guid({ version: "uuidv4" })
        .messages({ "string.guid": '"id" must be a valid UUID' })
        .required(),
});

export const fallbackSendSchema = Joi.object({
    eventId: Joi.string()
        .guid()
        .messages({ "string.guid": '"eventId" must be a valid UUID' })
        .optional(),
    eventType: Joi.string().valid(...eventTypes).required(),
    userId: Joi.string()
        .guid()
        .messages({ "string.guid": '"userId" must be a valid UUID' })
        .required(),
    initiatorId: Joi.string().optional().allow(null),
    payload: Joi.when("eventType", {
        is: "USER_PASSWORD_RESET_REQUESTED",
        then: passwordResetPayloadSchema.required(),
        otherwise: genericPayloadSchema.optional()
    }),
    source: Joi.string().optional(),
});
