import Joi from "joi"
import { config } from "../config/config.js"

// Common enums
export const visibilityEnum = ["public", "owner", "staff"] as const
export const moderationStatusEnum = ["approved", "flagged", "rejected"] as const

// Upload (multipart) body text fields (multer provides file separately)
export const uploadBodySchema = Joi.object({
    visibility: Joi.string()
        .valid(...visibilityEnum)
        .optional(),
    alt: Joi.string().trim().max(config.limits.altMaxLen).optional(),
    temporary: Joi.alternatives()
        .try(Joi.boolean(), Joi.string().valid("1", "0", "true", "false", "yes", "no", "on", "off"))
        .optional()
}).unknown(true) // allow extra fields from multipart

export const uploadQuerySchema = Joi.object({
    temporary: Joi.alternatives()
        .try(Joi.boolean(), Joi.string().valid("1", "0", "true", "false", "yes", "no", "on", "off"))
        .optional()
}).unknown(true)

export const listQuerySchema = Joi.object({
    owner: Joi.string().uuid().optional(),
    status: Joi.string()
        .valid(...moderationStatusEnum)
        .optional(),
    visibility: Joi.string()
        .valid(...visibilityEnum)
        .optional(),
    date_from: Joi.date().iso().optional(),
    date_to: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
}).unknown(false)

export const patchBodySchema = Joi.object({
    visibility: Joi.string().valid(...visibilityEnum),
    alt: Joi.string().trim().max(config.limits.altMaxLen),
    action: Joi.string().valid("approve", "reject", "flag"),
    censor: Joi.object({
        // Allow any integer here and let controller clamp to configured bounds
        strength: Joi.number().integer()
    }),
    uncensor: Joi.boolean()
})
    .min(1)
    .unknown(false)

export const bulkIdsSchema = Joi.object({
    ids: Joi.array().items(Joi.string().uuid()).min(1).required()
}).unknown(false)

export function parseBooleanFlexible(value: any): boolean | undefined {
    if (typeof value === "boolean") return value
    if (typeof value === "string") return /^(1|true|yes|on)$/i.test(value)
    return undefined
}
