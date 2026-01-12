import { Request, Response } from "express"
import multer from "multer"
import { v4 as uuidv4 } from "uuid"
import crypto from "crypto"
import { config } from "../config/config.js"
import { errors } from "../errors/http-error.js"
import { detectMime, isAllowedMime } from "../storage/magic.js"
import { normalizeToJpeg, makeVariant, censorFullImagePixelate } from "../storage/image-processor.js"
import { writeFileBuffered, readFile, deleteFiles } from "../storage/fs-storage.js"
import { readFile as readFileFs } from "fs/promises"
import path from "path"
import { counters } from "../domain/counters.js"
import { db } from "../db/pool.js"
import { canViewMaster, canModerate, canCensor, canDelete, canUpdateOthers } from "../domain/policy.js"
import { emitAudit } from "../audit/audit-emitter.js"
import { auditEvents } from "../audit/events.js"
import { moderateImage } from "../moderation/openai-moderation.js"
import { MediaEntity, ModerationStatus, Visibility } from "../db/types.js"
import { scanBuffer } from "../domain/av-scanner.js"
import { sanitizeString } from "../utils/sanitize.js"
import {
    uploadBodySchema,
    uploadQuerySchema,
    listQuerySchema,
    bulkIdsSchema,
    parseBooleanFlexible,
    patchBodySchema
} from "../validation/media-schemas.js"
import { logger } from "../logger/logger.js"
import { notificationClient } from "../clients/notification-client.js"

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.limits.maxBytes } })

/** Media CRUD + moderation + temporary lifecycle endpoints. */
export const mediaController = {
    upload: [
        upload.single("file"),
        async (req: Request, res: Response) => {
            const context = await prepareUploadContext(req)
            const entity = await persistUpload(context)
            counters.uploads += 1
            await emitAudit(auditEvents.mediaUploaded(context.ownerId, context.id, context.isTemporary))
            return res.status(201).json(entity)
        }
    ],

    getMaster: async (req: Request, res: Response) => {
        const id = req.params.id
        const q = await db.query<MediaEntity>("SELECT * FROM media_assets WHERE id=$1", [id])
        const m = q.rows[0]
        if (!m) throw errors.notFound("Media not found")

        if (m.deleted) {
            // Serve deleted placeholder
            counters.reads.master += 1
            return servePlaceholder(res, "deleted")
        }

        const userId = (req as any).userId as string | undefined
        const isOwner = userId && userId === m.owner_id
        const allowed = await canViewMaster(userId, m.owner_id, m.status, m.visibility)
        if (!allowed) {
            counters.reads.master += 1
            return servePlaceholder(res, "forbidden")
        }
        // If not approved and requester is neither staff nor owner, serve a generic flagged placeholder
        if (m.status !== "approved") {
            const isStaff = await canViewAll(userId || "")
            if (!isStaff && !isOwner) {
                counters.reads.master += 1
                return servePlaceholder(res, "flagged")
            }
        }

        // If censored and requester is not staff/owner, serve censored master if available
        const canViewAllResult = await canViewAll(userId || "")
        logger.debug("Censor check", {
            mediaId: id,
            isCensored: m.is_censored,
            userId: userId || "(none)",
            isOwner,
            canViewAllResult,
            willServeCensored: m.is_censored && !canViewAllResult && !isOwner
        })
        if (m.is_censored && !canViewAllResult && !isOwner) {
            const censored = await readFile(config.mediaRoot, id, "censored")
            if (censored) {
                counters.reads.master += 1
                setNoStoreHeaders(res)
                const etag = makeEtag(censored)
                const inm = req.headers["if-none-match"]
                if (typeof inm === "string" && inm === etag) {
                    res.setHeader("ETag", etag)
                    res.setHeader("Content-Type", "image/jpeg")
                    return res.status(304).end()
                }
                res.setHeader("ETag", etag)
                res.setHeader("Content-Type", "image/jpeg")
                res.setHeader("X-Media-Served", "censored")
                return res.status(200).end(censored)
            } else {
                logger.warn("Censored file missing", { mediaId: id })
            }
        }

        const bytes = await readFile(config.mediaRoot, id, "master")
        if (!bytes) throw errors.notFound("Media content missing")
        counters.reads.master += 1
        setNoStoreHeaders(res)
        const etag = makeEtag(bytes)
        const inm = req.headers["if-none-match"]
        if (typeof inm === "string" && inm === etag) {
            res.setHeader("ETag", etag)
            res.setHeader("Content-Type", "image/jpeg")
            return res.status(304).end()
        }
        res.setHeader("ETag", etag)
        res.setHeader("Content-Type", "image/jpeg")
        return res.status(200).end(bytes)
    },

    getThumb: async (req: Request, res: Response) => serveVariant(req, res, "thumb"),
    getPreview: async (req: Request, res: Response) => serveVariant(req, res, "preview"),

    list: async (req: Request, res: Response) => {
        const userId = (req as any).userId as string | undefined
        const canReadAll = userId ? await canViewAll(userId) : false

        const { error: listErr, value: listVal } = listQuerySchema.validate(req.query, {
            abortEarly: false,
            convert: true
        })
        if (listErr) throw errors.validation(listErr.details.map(d => `Query: ${d.message}`))
        const { owner, status, visibility, date_from, date_to, page, limit } = listVal as any
        const statusVal = status as ModerationStatus | undefined
        const visVal = visibility as Visibility | undefined
        const pageNum = page
        const pageSize = limit

        const where: string[] = []
        const params: any[] = []
        let p = 1

        if (owner && canReadAll) {
            where.push(`owner_id=$${p++}`)
            params.push(owner)
        }
        if (!canReadAll) {
            where.push(`owner_id=$${p++}`)
            params.push(userId)
        }
        if (statusVal) {
            where.push(`status=$${p++}`)
            params.push(statusVal)
        }
        if (visVal) {
            where.push(`visibility=$${p++}`)
            params.push(visVal)
        }
        if (date_from) {
            where.push(`created_at >= $${p++}`)
            params.push(new Date(date_from))
        }
        if (date_to) {
            where.push(`created_at <= $${p++}`)
            params.push(new Date(date_to))
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

        const rows = await db.query<MediaEntity>(
            `SELECT * FROM media_assets ${whereSql} ORDER BY created_at DESC OFFSET $${p} LIMIT $${p + 1}`,
            [...params, (pageNum - 1) * pageSize, pageSize]
        )

        // Total count
        const totalQ = await db.query<{ count: string }>(`SELECT COUNT(1) FROM media_assets ${whereSql}`, params)
        const total = parseInt(totalQ.rows[0].count, 10) || 0
        const totalPages = Math.max(1, Math.ceil(total / pageSize))

        return res.status(200).json({
            data: rows.rows,
            pagination: {
                page: pageNum,
                pageSize,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1
            }
        })
    },

    patch: async (req: Request, res: Response) => {
        // Validate patch body
        const { error: patchErr } = patchBodySchema.validate(req.body, { abortEarly: false, convert: true })
        if (patchErr) throw errors.validation(patchErr.details.map(d => d.message))

        const id = req.params.id
        const q = await db.query<MediaEntity>("SELECT * FROM media_assets WHERE id=$1", [id])
        const m = q.rows[0]
        if (!m) throw errors.notFound("Media not found")

        const userId = (req as any).userId as string | undefined
        const isOwner = userId && userId === m.owner_id

        const updates: string[] = []
        const params: any[] = []
        let p = 1

        // Visibility / alt updates
        let visibilityChangedFrom: string | null = null
        let visibilityChangedTo: string | null = null
        if (typeof req.body?.visibility === "string") {
            const newVis = req.body.visibility as Visibility
            if (!isOwner && !(await canUpdateOthers(userId)))
                throw errors.forbidden("Insufficient permissions", {
                    permission: "media:update",
                    issue: "actor_not_owner"
                })
            if (newVis !== m.visibility) {
                visibilityChangedFrom = m.visibility
                visibilityChangedTo = newVis
                updates.push(`visibility=$${p++}`)
                params.push(newVis)
            }
        }
        if (typeof req.body?.alt === "string") {
            const altSan = sanitizeString(req.body.alt, config.limits.altMaxLen)
            if (!isOwner && !(await canUpdateOthers(userId)))
                throw errors.forbidden("Insufficient permissions", {
                    permission: "media:update",
                    issue: "actor_not_owner"
                })
            if (altSan !== m.alt) {
                updates.push(`alt=$${p++}`)
                params.push(altSan)
            }
        }

        // Moderation action
        if (typeof req.body?.action === "string") {
            if (!(await canModerate(userId)))
                throw errors.forbidden("Insufficient permissions", {
                    permission: "media:moderate",
                    issue: "missing_permission"
                })
            const action = req.body.action as "approve" | "reject" | "flag"
            const from = m.status
            let to: ModerationStatus = m.status
            if (action === "approve") to = "approved"
            if (action === "reject") to = "rejected"
            if (action === "flag") to = "flagged"
            if (to !== from) {
                updates.push(`status=$${p++}`)
                params.push(to)
                await emitAudit(auditEvents.moderationChanged(userId, id, from, to))
            }
        }

        // Manual censor: always full-image
        if (req.body?.censor) {
            if (!(await canCensor(userId)))
                throw errors.forbidden("Insufficient permissions", {
                    permission: "media:censor",
                    issue: "missing_permission"
                })
            let strength = Number(req.body?.censor?.strength) || config.censor.defaultStrength
            if (strength < config.censor.minStrength) strength = config.censor.minStrength
            if (strength > config.censor.maxStrength) strength = config.censor.maxStrength
            const master = await readFile(config.mediaRoot, id, "master")
            if (!master) throw errors.notFound("Media content missing")
            const censored = await censorFullImagePixelate(master, strength, config.sizes.jpegQuality)
            await writeFileBuffered(config.mediaRoot, id, "censored", censored)
            // Rebuild variants from censored master to keep consistency for public view
            try {
                const cThumb = await makeVariant(censored, {
                    maxSide: config.sizes.thumbMax,
                    jpegQuality: config.sizes.jpegQuality
                })
                const cPreview = await makeVariant(censored, {
                    maxSide: config.sizes.previewMax,
                    jpegQuality: config.sizes.jpegQuality
                })
                await writeFileBuffered(config.mediaRoot, id, "thumb", cThumb)
                await writeFileBuffered(config.mediaRoot, id, "preview", cPreview)
            } catch {
                /* best-effort */
            }
            // Flag entity as censored in DB (and store strength)
            updates.push(`is_censored=true`)
            updates.push(`censor_strength=$${p++}`)
            params.push(strength)
            updates.push(`censored_at=now()`)
            await emitAudit(auditEvents.mediaCensored(userId, id, "pixelate", strength))
        }

        // Uncensor: revert to original master and rebuild variants
        if (req.body?.uncensor === true) {
            if (!(await canCensor(userId)))
                throw errors.forbidden("Insufficient permissions", {
                    permission: "media:censor",
                    issue: "missing_permission"
                })
            const master = await readFile(config.mediaRoot, id, "master")
            if (!master) throw errors.notFound("Media content missing")
            try {
                const t = await makeVariant(master, {
                    maxSide: config.sizes.thumbMax,
                    jpegQuality: config.sizes.jpegQuality
                })
                const pvw = await makeVariant(master, {
                    maxSide: config.sizes.previewMax,
                    jpegQuality: config.sizes.jpegQuality
                })
                await writeFileBuffered(config.mediaRoot, id, "thumb", t)
                await writeFileBuffered(config.mediaRoot, id, "preview", pvw)
            } catch {
                /* best-effort */
            }
            // Remove censored file from disk
            try {
                const censoredPath = await import("../storage/paths.js").then(m =>
                    m.shardPath(config.mediaRoot, id, "censored")
                )
                await import("fs/promises").then(fs => fs.unlink(censoredPath))
            } catch {
                /* file may not exist */
            }
            updates.push(`is_censored=false`)
            updates.push(`censor_strength=NULL`)
            updates.push(`censored_at=NULL`)
            await emitAudit(auditEvents.mediaUncensored(userId, id))
        }

        if (updates.length) {
            updates.push(`updated_at=now()`)
            params.push(id)
            await db.query(`UPDATE media_assets SET ${updates.join(", ")} WHERE id=$${p}`, params)
        }

        const fresh = await db.query<MediaEntity>("SELECT * FROM media_assets WHERE id=$1", [id])
        if (visibilityChangedFrom && visibilityChangedTo) {
            await emitAudit(auditEvents.visibilityChanged(userId, id, visibilityChangedFrom, visibilityChangedTo))
        }
        return res.status(200).json(fresh.rows[0])
    },

    remove: async (req: Request, res: Response) => {
        const id = req.params.id
        const q = await db.query<MediaEntity>("SELECT * FROM media_assets WHERE id=$1", [id])
        const m = q.rows[0]
        if (!m) throw errors.notFound("Media not found")
        const userId = (req as any).userId as string | undefined
        if (!(await canDelete(userId)))
            throw errors.forbidden("Insufficient permissions", {
                permission: "media:delete",
                issue: "missing_permission"
            })

        await deleteFiles(config.mediaRoot, id)
        await db.query("UPDATE media_assets SET deleted=true, deleted_at=now(), updated_at=now() WHERE id=$1", [id])
        counters.deletes += 1
        await emitAudit(auditEvents.mediaDeleted(userId, id))

        return res.status(204).send()
    },

    keepTemporary: async (req: Request, res: Response) => {
        const { error: bulkErr, value: bulkVal } = bulkIdsSchema.validate(req.body, { abortEarly: false })
        if (bulkErr) throw errors.validation(bulkErr.details.map(d => `Body: ${d.message}`))
        const ids: string[] = bulkVal.ids
        const userId = requireUserId(req)
        const canUpdateAll = await canUpdateOthers(userId)
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(",")
        const existing = await db.query<Pick<MediaEntity, "id" | "owner_id">>(
            `SELECT id, owner_id FROM media_assets WHERE deleted=false AND id IN (${placeholders})`,
            ids
        )
        if (!existing.rows.length) return res.status(200).json({ kept: [], requested: ids })
        const unauthorized = existing.rows.filter(row => row.owner_id !== userId && !canUpdateAll)
        if (unauthorized.length) {
            throw errors.forbidden("Insufficient permissions", {
                permission: "media:update",
                issue: "owner_mismatch",
                ids: unauthorized.map(r => r.id)
            })
        }
        const allowedIds = existing.rows.map(r => r.id)
        const updPlaceholders = allowedIds.map((_, i) => `$${i + 1}`).join(",")
        const sql = `UPDATE media_assets SET is_temporary=false, expires_at=NULL, updated_at=now() WHERE is_temporary=true AND deleted=false AND id IN (${updPlaceholders}) RETURNING id`
        const r = await db.query<{ id: string }>(sql, allowedIds)
        const kept = r.rows.map(r => r.id)
        if (kept.length) await emitAudit(auditEvents.temporaryKept(userId, kept))
        return res.status(200).json({ kept, requested: ids })
    },

    rejectTemporary: async (req: Request, res: Response) => {
        const { error: bulkErr2, value: bulkVal2 } = bulkIdsSchema.validate(req.body, { abortEarly: false })
        if (bulkErr2) throw errors.validation(bulkErr2.details.map(d => `Body: ${d.message}`))
        const ids: string[] = bulkVal2.ids
        const userId = requireUserId(req)
        const canDeleteAll = await canDelete(userId)
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(",")
        const existing = await db.query<Pick<MediaEntity, "id" | "owner_id" | "deleted">>(
            `SELECT id, owner_id, deleted FROM media_assets WHERE id IN (${placeholders})`,
            ids
        )
        if (!existing.rows.length) return res.status(200).json({ rejected: [], requested: ids })
        const unauthorized = existing.rows.filter(row => !row.deleted && row.owner_id !== userId && !canDeleteAll)
        if (unauthorized.length) {
            throw errors.forbidden("Insufficient permissions", {
                permission: "media:delete",
                issue: "owner_mismatch",
                ids: unauthorized.map(r => r.id)
            })
        }
        const targetIds = existing.rows.filter(row => !row.deleted).map(row => row.id)
        if (!targetIds.length) return res.status(200).json({ rejected: [], requested: ids })
        const updPlaceholders = targetIds.map((_, i) => `$${i + 1}`).join(",")
        const upd = await db.query(
            `UPDATE media_assets SET deleted=true, deleted_at=now(), updated_at=now() WHERE id IN (${updPlaceholders}) RETURNING id`,
            targetIds
        )
        for (const row of existing.rows.filter(r => targetIds.includes(r.id))) {
            try {
                await deleteFiles(config.mediaRoot, row.id)
            } catch { }
        }
        const rejected = upd.rows.map((r: any) => r.id)
        if (rejected.length) await emitAudit(auditEvents.temporaryRejected(userId, rejected))
        return res.status(200).json({ rejected, requested: ids })
    }
}

/** Serve a cached derivative (thumb/preview) with immutable caching if approved. */
async function serveVariant(req: Request, res: Response, variant: "thumb" | "preview") {
    const id = req.params.id
    const q = await db.query<MediaEntity>("SELECT * FROM media_assets WHERE id=$1", [id])
    const m = q.rows[0]
    if (!m) throw errors.notFound("Media not found")

    if (m.deleted) {
        incVariant(variant)
        return servePlaceholder(res, "deleted")
    }

    const userId = (req as any).userId as string | undefined
    const isStaff = await canViewAll(userId || "")
    const isOwner = userId && userId === m.owner_id
    if (!isStaff && !isOwner && m.status !== "approved") {
        incVariant(variant)
        return servePlaceholder(res, "flagged")
    }

    // If censored and requester is not staff/owner, serve censored-derived variants
    if (m.is_censored && !isStaff && !isOwner) {
        // For variants, censored 'thumb'/'preview' were rebuilt on censor; fall back to 'censored' master resize if missing
        let bytes = await readFile(config.mediaRoot, id, variant)
        if (!bytes) {
            const cMaster = await readFile(config.mediaRoot, id, "censored")
            if (!cMaster) throw errors.notFound("Media content missing")
            // On-the-fly resize (rare path)
            try {
                const v = await makeVariant(cMaster, {
                    maxSide: variant === "thumb" ? config.sizes.thumbMax : config.sizes.previewMax,
                    jpegQuality: config.sizes.jpegQuality
                })
                bytes = v
            } catch {
                bytes = cMaster
            }
        }
        incVariant(variant)
        setNoStoreHeaders(res)
        const etag = makeEtag(bytes)
        const inm = req.headers["if-none-match"]
        if (typeof inm === "string" && inm === etag) {
            res.setHeader("ETag", etag)
            res.setHeader("Content-Type", "image/jpeg")
            res.setHeader("X-Media-Served", "censored")
            return res.status(304).end()
        }
        res.setHeader("ETag", etag)
        res.setHeader("Content-Type", "image/jpeg")
        res.setHeader("X-Media-Served", "censored")
        return res.status(200).end(bytes)
    }

    const bytes = await readFile(config.mediaRoot, id, variant)
    if (!bytes) throw errors.notFound("Media content missing")
    incVariant(variant)
    setImmutableHeaders(req, res, bytes)
    res.setHeader("Content-Type", "image/jpeg")
    return res.status(200).end(bytes)
}

function incVariant(v: "thumb" | "preview") {
    if (v === "thumb") counters.reads.thumb += 1
    else counters.reads.preview += 1
}

// Cache header helpers
/** Set long-lived immutable cache headers & handle conditional request. */
function setImmutableHeaders(req: Request, res: Response, bytes: Buffer) {
    const etag = makeEtag(bytes)
    const inm = req.headers["if-none-match"]
    if (typeof inm === "string" && inm === etag) {
        res.setHeader("ETag", etag)
        res.setHeader("Cache-Control", `public, max-age=${config.cache.immutableMaxAgeSeconds}, immutable`)
        res.status(304).end()
        return
    }
    res.setHeader("ETag", etag)
    res.setHeader("Cache-Control", `public, max-age=${config.cache.immutableMaxAgeSeconds}, immutable`)
}

/** Disable caching for master/placeholder responses. */
function setNoStoreHeaders(res: Response) {
    res.setHeader("Cache-Control", "no-store")
}

function makeEtag(bytes: Buffer): string {
    const h = crypto.createHash("sha256").update(bytes).digest("hex")
    return 'W/"' + h + '"'
}

function requireUserId(req: Request): string {
    const userId = (req as any).userId as string | undefined
    if (!userId) {
        throw errors.unauthorized("Missing user identity", { header: "X-User-ID", issue: "missing" })
    }
    if (userId.length > 128) {
        throw errors.unauthorized("Invalid user identity", { header: "X-User-ID", issue: "too_long" })
    }
    return userId
}

type UploadContext = {
    ownerId: string
    file: Express.Multer.File
    visibility: Visibility
    alt: string | null
    isTemporary: boolean
    expiresAt: Date | null
    normalized: {
        bytes: Buffer
        width: number | null
        height: number | null
        contentHash: string
    }
    moderation: {
        status: ModerationStatus
        flagged: boolean | null
        decisionTimeMs: number | null
    }
    originalName: string | null
    id: string
}

async function prepareUploadContext(req: Request): Promise<UploadContext> {
    const ownerId = requireUserId(req)
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file || !file.buffer) throw errors.validation(["Body: file is required"])
    if (file.size > config.limits.maxBytes) throw errors.tooLarge("File exceeds size limit")

    const { error: bodyErr, value: bodyVal } = uploadBodySchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        stripUnknown: false
    })
    if (bodyErr) throw errors.validation(bodyErr.details.map(d => `Body: ${d.message}`))
    const { error: queryErr, value: queryVal } = uploadQuerySchema.validate(req.query, {
        abortEarly: false,
        convert: true
    })
    if (queryErr) throw errors.validation(queryErr.details.map(d => `Query: ${d.message}`))

    const visibility: Visibility = bodyVal.visibility || "owner"
    const alt = sanitizeString(bodyVal.alt, config.limits.altMaxLen)

    const tempFlagRaw = queryVal.temporary ?? bodyVal.temporary
    const isTemporary = parseBooleanFlexible(tempFlagRaw) || false
    const expiresAt = isTemporary ? new Date(Date.now() + config.tempMediaTtlHours * 3600_000) : null

    const { mime } = await detectMime(file.buffer)
    if (!isAllowedMime(mime)) throw errors.unsupported("Only JPEG and PNG are allowed")

    const norm = await normalizeToJpeg(file.buffer, { jpegQuality: config.sizes.jpegQuality })
    const pixels = (norm.info.width || 0) * (norm.info.height || 0)
    if (pixels > config.limits.maxPixels) throw errors.tooLarge("Image dimensions too large")
    const contentHash = crypto.createHash("sha256").update(norm.bytes).digest("hex")

    if (config.antivirus.enabled) {
        const av = await scanBuffer(file.buffer)
        if (av.detected) {
            throw errors.unprocessable("Antivirus detected a threat", {
                code: "AV_DETECTED",
                engine: av.engine
            })
        }
    }

    let status: ModerationStatus = "approved"
    let moderationFlagged: boolean | null = null
    let moderationDecisionTimeMs: number | null = null
    if (config.moderation.enabled) {
        const r = await moderateImage(norm.bytes)
        moderationFlagged = r.flagged
        moderationDecisionTimeMs = r.elapsedMs
        if (r.flagged) {
            status = "flagged"
            if (ownerId) {
                // Async no-await to not block upload
                notificationClient.sendMediaFlaggedNSFW(ownerId, file.originalname || "image.jpg").catch(() => {})
            }
        }
    }

    const id = uuidv4()

    return {
        ownerId,
        file,
        visibility,
        alt,
        isTemporary,
        expiresAt,
        normalized: {
            bytes: norm.bytes,
            width: norm.info.width ?? null,
            height: norm.info.height ?? null,
            contentHash
        },
        moderation: {
            status,
            flagged: moderationFlagged,
            decisionTimeMs: moderationDecisionTimeMs
        },
        originalName: file.originalname || null,
        id
    }
}

async function persistUpload(context: UploadContext): Promise<MediaEntity> {
    const { id, ownerId, visibility, normalized, moderation, isTemporary, expiresAt, originalName, alt } = context
    let staged = false
    try {
        const thumb = await makeVariant(normalized.bytes, {
            maxSide: config.sizes.thumbMax,
            jpegQuality: config.sizes.jpegQuality
        })
        const preview = await makeVariant(normalized.bytes, {
            maxSide: config.sizes.previewMax,
            jpegQuality: config.sizes.jpegQuality
        })
        await writeFileBuffered(config.mediaRoot, id, "master", normalized.bytes)
        staged = true
        await writeFileBuffered(config.mediaRoot, id, "thumb", thumb)
        await writeFileBuffered(config.mediaRoot, id, "preview", preview)

        const inserted = await db.query<MediaEntity>(
            `INSERT INTO media_assets (
                id, owner_id, visibility, status, deleted, content_type, size_bytes, width, height, content_hash,
                original_filename, alt, tags, collection, moderation_flagged, moderation_decision_time_ms,
                is_temporary, expires_at, is_censored, censor_strength, censored_at
            ) VALUES (
                $1,$2,$3,$4,false,$5,$6,$7,$8,$9,$10,$11,$12,NULL,$13,$14,$15,$16,false,NULL,NULL
            ) RETURNING *`,
            [
                id,
                ownerId,
                visibility,
                moderation.status,
                "image/jpeg",
                normalized.bytes.length,
                normalized.width,
                normalized.height,
                normalized.contentHash,
                originalName,
                alt,
                null,
                moderation.flagged,
                moderation.decisionTimeMs,
                isTemporary,
                expiresAt
            ]
        )
        return inserted.rows[0]
    } catch (err) {
        if (staged) {
            await cleanupStagedFiles(id)
        }
        throw err
    }
}

async function cleanupStagedFiles(id: string): Promise<void> {
    try {
        await deleteFiles(config.mediaRoot, id)
    } catch (cleanupErr) {
        const cleanupMessage = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
        logger.warn("upload_cleanup_failed", { mediaId: id, error: cleanupMessage })
    }
}

/** Check elevated permission to view all assets (delegated to authz service). */
async function canViewAll(userId: string): Promise<boolean> {
    // efficient path for variant serving
    try {
        const { hasPermission } = await import("../authz/authz-adapter.js")
        const { Permissions } = await import("../authz/permissions.js")
        return hasPermission(userId, Permissions.READ_ALL)
    } catch {
        return false
    }
}

/** Return bundled placeholder image; fallback to 1x1 jpeg if missing on disk. */
async function servePlaceholder(res: Response, kind: "flagged" | "deleted" | "forbidden") {
    const candidates = [
        path.join(process.cwd(), "src", "assets", "placeholders", kind + ".jpg"),
        path.join(process.cwd(), "assets", "placeholders", kind + ".jpg")
    ]
    for (const p of candidates) {
        try {
            const bytes = await readFileFs(p)
            res.setHeader("Content-Type", "image/jpeg")
            setNoStoreHeaders(res)
            return res.status(200).end(bytes)
        } catch { }
    }
    const base64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY/j///9/AAn7A/0FQ0XKAAAAAElFTkSuQmCC"
    const bytes = Buffer.from(base64, "base64")
    res.setHeader("Content-Type", "image/jpeg")
    setNoStoreHeaders(res)
    return res.status(200).end(bytes)
}
