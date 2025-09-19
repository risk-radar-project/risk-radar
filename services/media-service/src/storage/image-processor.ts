import sharp from 'sharp';

export type NormalizeOptions = { jpegQuality: number };
export type VariantOptions = { maxSide: number; jpegQuality: number };

/** Normalize input (auto-rotate, strip metadata) to JPEG returning bytes + dimensions. */
export async function normalizeToJpeg(input: Buffer, opts: NormalizeOptions): Promise<{ bytes: Buffer; info: { width: number; height: number } }> {
    const img = sharp(input, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const pipeline = img.jpeg({ quality: opts.jpegQuality, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' });
    const bytes = await pipeline.toBuffer();
    return { bytes, info: { width: meta.width || 0, height: meta.height || 0 } };
}

/** Create a resized JPEG variant, preserving aspect ratio within maxSide constraint. */
export async function makeVariant(input: Buffer, opts: VariantOptions): Promise<Buffer> {
    const img = sharp(input).resize({ width: opts.maxSide, height: opts.maxSide, fit: 'inside', withoutEnlargement: true });
    return img.jpeg({ quality: opts.jpegQuality, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
}

/** Pixelate entire image via downscale-then-upscale nearest resampling. */
export async function censorFullImagePixelate(input: Buffer, blockSize = 16, quality = 82): Promise<Buffer> {
    // Downscale then upscale with nearest to create pixelation effect
    const meta = await sharp(input).metadata();
    const w = Math.max(1, Math.floor((meta.width || 1) / blockSize));
    const h = Math.max(1, Math.floor((meta.height || 1) / blockSize));
    return sharp(input)
        .resize(w, h, { fit: 'fill', kernel: sharp.kernel.nearest })
        .resize(meta.width, meta.height, { kernel: sharp.kernel.nearest })
        .jpeg({ quality, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' })
        .toBuffer();
}
