import { Request, Response, NextFunction } from "express"
import { logger } from "../logger/logger.js"
import { config } from "../config/config.js"

const RESET = process.stdout && process.stdout.isTTY ? "\x1b[0m" : ""

function getStatusColor(status: number): string {
    if (!process.stdout || !process.stdout.isTTY) return ""
    if (status >= 200 && status < 300) return "\x1b[32m" // Green
    if (status >= 300 && status < 400) return "\x1b[33m" // Yellow
    if (status >= 400 && status < 500) return "\x1b[31m" // Red
    if (status >= 500) return "\x1b[35m" // Magenta
    return "\x1b[37m" // White
}

function getMethodColor(method: string): string {
    if (!process.stdout || !process.stdout.isTTY) return ""
    switch (method) {
        case "GET":
            return "\x1b[34m" // Blue
        case "POST":
            return "\x1b[32m" // Green
        case "PUT":
            return "\x1b[33m" // Yellow
        case "DELETE":
            return "\x1b[31m" // Red
        case "PATCH":
            return "\x1b[36m" // Cyan
        case "HEAD":
            return "\x1b[35m" // Magenta
        case "OPTIONS":
            return "\x1b[37m" // White
        default:
            return "\x1b[37m" // White
    }
}

function formatDurationNs(ns: number): string {
    if (ns === 0) return "~100ns"
    if (ns < 1_000) return `${ns}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}μs`
    if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)}ms`
    return `${(ns / 1_000_000_000).toFixed(2)}s`
}

/** Structured + colorized request log line (skips in test env). */
export function requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
        if (config.nodeEnv === "test") {
            next()
            return
        }

        const start = process.hrtime.bigint()

        res.on("finish", () => {
            const end = process.hrtime.bigint()
            const durationNs = Number(end - start)

            const status = res.statusCode
            const statusColor = getStatusColor(status)
            const methodColor = getMethodColor(req.method)
            const durationStr = formatDurationNs(durationNs).padStart(10)

            const remote = (req.ip || req.socket.remoteAddress || "-").toString()
            const remotePadded = remote.padStart(15)
            const methodPadded = req.method.padEnd(7)
            const url = (req.originalUrl || req.url || "/").toString()

            const lineTemplate = `| ${statusColor}%3d${RESET} | %s | %s | ${methodColor}%s${RESET} %s`
            const rendered = lineTemplate
                .replace("%3d", String(status).padStart(3))
                .replace("%s", durationStr)
                .replace("%s", remotePadded)
                .replace("%s", methodPadded)
                .replace("%s", url)

            logger.info(rendered)
        })

        next()
    }
}
