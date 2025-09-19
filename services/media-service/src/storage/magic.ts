import { fileTypeFromBuffer } from 'file-type';

const allowed = new Set(['image/jpeg', 'image/png']);

/** Best-effort MIME detection from magic bytes. */
export async function detectMime(buffer: Buffer): Promise<{ mime: string | null }> {
    const ft = await fileTypeFromBuffer(buffer);
    return { mime: ft?.mime || null };
}

/** Check allowlist for supported image MIME types. */
export function isAllowedMime(mime: string | null): boolean {
    if (!mime) return false;
    return allowed.has(mime);
}
