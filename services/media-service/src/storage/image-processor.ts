import sharp from "sharp"

export type NormalizeOptions = { jpegQuality: number }
export type VariantOptions = { maxSide: number; jpegQuality: number }

/** Normalize input (auto-rotate, strip metadata) to JPEG returning bytes + dimensions. */
export async function normalizeToJpeg(
    input: Buffer,
    opts: NormalizeOptions
): Promise<{ bytes: Buffer; info: { width: number; height: number } }> {
    const img = sharp(input, { failOn: "none" }).rotate()
    const meta = await img.metadata()
    const pipeline = img.jpeg({
        quality: opts.jpegQuality,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: "4:4:4"
    })
    const bytes = await pipeline.toBuffer()
    return { bytes, info: { width: meta.width || 0, height: meta.height || 0 } }
}

/** Create a resized JPEG variant, preserving aspect ratio within maxSide constraint. */
export async function makeVariant(input: Buffer, opts: VariantOptions): Promise<Buffer> {
    const img = sharp(input).resize({
        width: opts.maxSide,
        height: opts.maxSide,
        fit: "inside",
        withoutEnlargement: true
    })
    return img
        .jpeg({ quality: opts.jpegQuality, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" })
        .toBuffer()
}

/**
 * Censor image with strong pixelation + blur + desaturation.
 * blockSize: larger = more pixelated (e.g. 16 = moderate, 64 = heavy)
 */
export async function censorFullImagePixelate(input: Buffer, blockSize = 16, quality = 82): Promise<Buffer> {
    const meta = await sharp(input).metadata()
    const origWidth = meta.width || 1
    const origHeight = meta.height || 1

    // Calculate downscale dimensions
    const w = Math.max(1, Math.floor(origWidth / blockSize))
    const h = Math.max(1, Math.floor(origHeight / blockSize))

    // Step 1: Downscale to create pixelation
    const pixelated = await sharp(input).resize(w, h, { fit: "fill", kernel: sharp.kernel.nearest }).toBuffer()

    // Step 2: Apply blur to pixelated version (sigma scales with blockSize)
    const blurSigma = Math.max(0.3, blockSize / 8)
    const blurred = await sharp(pixelated).blur(blurSigma).toBuffer()

    // Step 3: Upscale back to original dimensions + desaturate
    return sharp(blurred)
        .resize(origWidth, origHeight, { fit: "fill", kernel: sharp.kernel.nearest })
        .modulate({ saturation: 0.3 }) // reduce color saturation to 30%
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer()
}
