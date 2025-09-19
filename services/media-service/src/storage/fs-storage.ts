import fs from 'fs/promises';
import path from 'path';
import checkDiskSpace from 'check-disk-space';
import { shardPath, Variant } from './paths.js';

/** Ensure parent directory exists (mkdir -p). */
export async function ensureDirFor(filePath: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/** Write a variant file (creates shard directories). Returns absolute path. */
export async function writeFileBuffered(root: string, id: string, variant: Variant, data: Buffer) {
    const p = shardPath(root, id, variant);
    await ensureDirFor(p);
    await fs.writeFile(p, data);
    return p;
}

/** Read a variant file; returns null if missing. */
export async function readFile(root: string, id: string, variant: Variant): Promise<Buffer | null> {
    const p = shardPath(root, id, variant);
    try {
        return await fs.readFile(p);
    } catch {
        return null;
    }
}

/** Delete all variant files (best-effort). */
export async function deleteFiles(root: string, id: string) {
    for (const v of ['master', 'thumb', 'preview', 'censored'] as Variant[]) {
        const p = shardPath(root, id, v);
        try { await fs.unlink(p); } catch { }
    }
}

/** Stat a specific variant file; returns null if not present. */
export async function statFile(root: string, id: string, variant: Variant) {
    const p = shardPath(root, id, variant);
    try { return await fs.stat(p); } catch { return null; }
}

/** Get disk usage for the partition containing root. Fallback: manual size walk. */
export async function getDiskUsage(root: string): Promise<{ root: string; totalBytes: number; usedBytes: number }> {
    // Try accurate disk stats; fallback to walking folder size
    root = path.resolve(root);
    try {
        await fs.mkdir(root, { recursive: true });
        const disk = await checkDiskSpace(root);
        const total = disk.size;
        const free = disk.free;
        const used = Math.max(0, total - free);
        return { root, totalBytes: total, usedBytes: used };
    } catch (err) {
        let used = 0;
        const walk = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) await walk(p);
                else if (e.isFile()) { const s = await fs.stat(p); used += s.size; }
            }
        };
        try { await walk(root); } catch { }
        return { root, totalBytes: used, usedBytes: used };
    }
}
