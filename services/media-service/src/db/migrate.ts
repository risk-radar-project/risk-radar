import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { db } from "./pool.js"
import { logger } from "../logger/logger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function ensureMigrationsTable() {
    await db.query(`CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)
}

async function alreadyRun(name: string): Promise<boolean> {
    const r = await db.query<{ count: string }>("SELECT COUNT(1) FROM _migrations WHERE name=$1", [name])
    return r.rows[0]?.count === "1"
}

/** Apply any pending .sql migrations (idempotent). */
export async function runMigrations() {
    await ensureMigrationsTable()
    let dir = path.join(__dirname, "migrations")
    if (!fs.existsSync(dir)) {
        // Fallback to source migrations when running from ts-node or misbuilt
        const srcDir = path.join(__dirname, "..", "..", "src", "db", "migrations")
        if (fs.existsSync(srcDir)) dir = srcDir
    }
    if (!fs.existsSync(dir)) {
        throw new Error(`Migrations directory not found at ${dir}`)
    }
    const files = fs
        .readdirSync(dir)
        .filter(f => f.endsWith(".sql"))
        .sort()
    logger.debug("Migrations scan", { dir, files })
    for (const f of files) {
        if (await alreadyRun(f)) {
            logger.debug("Migration already applied", { file: f })
            continue
        }
        logger.debug("Applying migration", { file: f })
        const sql = fs.readFileSync(path.join(dir, f), "utf-8")
        await db.query(sql)
        await db.query("INSERT INTO _migrations(name) VALUES ($1)", [f])
    }
    // Post-check: verify core table exists after migrations
    try {
        await db.query("SELECT 1 FROM media_assets LIMIT 1")
    } catch (e: any) {
        logger.error("Core table missing after migrations", { table: "media_assets" })
    }
}
