import axios from "axios"
import sharp from "sharp"
import { config } from "../config/config.js"
import { logger } from "../logger/logger.js"

export type ModerationResult = { flagged: boolean; elapsedMs: number }

// Direct call to OpenAI moderation with image base64 (omni-moderation-latest).
// Fail-closed: any error => flagged = true.

/** Downscale & re-encode for moderation efficiency while respecting pixel budget. */
async function preprocess(buffer: Buffer): Promise<Buffer> {
    try {
        const img = sharp(buffer)
        const metadata = await img.metadata()
        const { resize } = config.moderation
        if (!metadata.width || !metadata.height) return buffer // unknown
        let { width, height } = metadata
        // scale down if exceeding width/height
        const widthRatio = resize.maxWidth / width
        const heightRatio = resize.maxHeight / height
        const scale = Math.min(1, widthRatio, heightRatio)
        width = Math.floor(width * scale)
        height = Math.floor(height * scale)
        // ensure pixel budget
        const pixels = width * height
        if (pixels > resize.maxPixels) {
            const scale2 = Math.sqrt(resize.maxPixels / pixels)
            width = Math.max(1, Math.floor(width * scale2))
            height = Math.max(1, Math.floor(height * scale2))
        }
        return await img
            .resize(width, height, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: resize.jpegQuality })
            .toBuffer()
    } catch (err) {
        logger.debug("Moderation preprocess failed, using original buffer", { error: (err as any)?.message })
        return buffer // fallback to original
    }
}

/** Submit image to OpenAI moderation; on error returns flagged=true (fail-closed). */
export async function moderateImage(buffer: Buffer): Promise<ModerationResult> {
    if (!config.moderation.enabled) return { flagged: false, elapsedMs: 0 }
    if (!config.moderation.apiKey) {
        logger.warn("Moderation enabled but OPENAI_API_KEY missing")
        return { flagged: false, elapsedMs: 0 }
    }
    const t0 = Date.now()
    try {
        const optimized = await preprocess(buffer)
        const b64 = optimized.toString("base64")
        const dataUrl = `data:image/jpeg;base64,${b64}`
        const resp = await axios.post(
            "https://api.openai.com/v1/moderations",
            {
                model: config.moderation.model,
                input: [{ type: "image_url", image_url: { url: dataUrl } }]
            },
            {
                timeout: config.moderation.timeoutMs,
                headers: { Authorization: `Bearer ${config.moderation.apiKey}` }
            }
        )
        const flagged = Boolean(resp.data?.results?.[0]?.flagged)
        return { flagged, elapsedMs: Date.now() - t0 }
    } catch (e: any) {
        logger.warn("Moderation request failed (fail-closed => flagged)", {
            error: e?.response?.data || e?.message || String(e),
            status: e?.response?.status
        })
        const flagged = config.moderation.failOpen ? false : true
        return { flagged, elapsedMs: Date.now() - t0 }
    }
}
