import "dotenv/config"
import { createServer, Server } from "http"
import app from "./app.js"
import { config } from "./config/config.js"
import { logger } from "./logger/logger.js"
import { runMigrations } from "./db/migrate.js"
import { db } from "./db/pool.js"
import { gc } from "./domain/gc.js"

export class MediaServer {
    private server: Server | null = null
    private starting = false
    private started = false

    async start(): Promise<void> {
        if (this.started || this.starting) return
        this.starting = true
        logger.info("Starting Media Service...")
        const maxRetries = parseInt(process.env.BOOTSTRAP_DB_RETRIES || "30", 10)
        let delay = parseInt(process.env.BOOTSTRAP_DB_DELAY_MS || "2000", 10)

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info("DB bootstrap attempt", { attempt, maxRetries, delay })
                await db.waitForConnection()
                await runMigrations()
                break
            } catch (e: any) {
                const msg = e?.message || String(e)
                logger.warn("DB bootstrap attempt failed", { attempt, maxRetries, error: msg })
                if (attempt === maxRetries) {
                    this.starting = false
                    logger.error("Exhausted DB bootstrap retries")
                    throw e
                }
                await new Promise(r => setTimeout(r, delay))
                delay = Math.min(delay * 1.5 + Math.random() * 1000, 10_000)
            }
        }

        this.server = createServer(app)

        await new Promise<void>((resolve, reject) => {
            this.server!.listen(config.httpPort, (err?: Error) => {
                if (err) return reject(err)
                logger.info("Media Service listening", { port: config.httpPort })
                resolve()
            })
        })

        gc.start()
        logger.info("GC started")
        this.started = true
        this.starting = false
        logger.info("Media Service started successfully")
    }

    async stop(): Promise<void> {
        logger.info("Stopping Media Service...")
        try {
            gc.stop()
            logger.info("GC stopped")
        } catch {
            /* ignore */
        }
        if (this.server) {
            await new Promise<void>(resolve => this.server!.close(() => resolve()))
            logger.info("HTTP server closed")
        }
        try {
            await db.close()
            logger.info("DB pool closed")
        } catch (e: any) {
            logger.warn("DB close error", { error: e?.message })
        }
        this.started = false
        logger.info("Media Service stopped")
    }
}

export default MediaServer
