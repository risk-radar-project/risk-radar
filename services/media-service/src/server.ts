import "dotenv/config"
import { logger } from "./logger/logger.js"
import MediaServer from "./media-server.js"

const mediaServer = new MediaServer()

const startPromise = mediaServer.start().catch(err => {
    const error = err instanceof Error ? err.message : String(err)
    logger.error("Media Service failed to start", { error })
    process.exit(1)
})

const shutdown = (signal: string) => {
    logger.warn("Shutdown signal received", { signal })
    const finalize = async () => {
        try {
            await startPromise.catch(() => undefined)
            await mediaServer.stop()
            process.exit(0)
        } catch (err: unknown) {
            const error = err instanceof Error ? err.message : String(err)
            logger.error("Graceful shutdown failed", { error })
            process.exit(1)
        }
    }
    finalize().catch(e => {
        const error = e instanceof Error ? e.message : String(e)
        logger.error("Shutdown error", { error })
        process.exit(1)
    })
    setTimeout(() => {
        logger.error("Forced shutdown after timeout")
        process.exit(1)
    }, 10_000).unref()
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

export default mediaServer
