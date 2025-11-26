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
    "USER_BANNED",
    "USER_UNBANNED"
] as const;

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
        .guid({ version: "uuidv4" })
        .messages({ "string.guid": '"eventId" must be a valid UUID' })
        .optional(),
    eventType: Joi.string().valid(...eventTypes).required(),
    userId: Joi.string()
        .guid({ version: "uuidv4" })
        .messages({ "string.guid": '"userId" must be a valid UUID' })
        .required(),
    initiatorId: Joi.string().optional().allow(null),
    payload: Joi.object().unknown(true).optional(),
    source: Joi.string().optional(),
});
