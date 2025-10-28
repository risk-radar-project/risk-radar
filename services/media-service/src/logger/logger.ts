import winston from "winston"
import fs from "fs"
import path from "path"
import { config } from "../config/config.js"

export const logger = winston.createLogger({
    level: config.logLevel,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                winston.format.colorize(),
                winston.format.printf((info: winston.Logform.TransformableInfo) => {
                    const { timestamp, level, message, ...rest } = info as unknown as Record<string, unknown>
                    const args = rest as Record<string, unknown>
                    const argsString = Object.keys(args).length > 0 ? " " + JSON.stringify(args) : ""
                    return `[${timestamp}] ${level}: ${String(message)}${argsString}`
                })
            )
        })
    ]
})

if (config.nodeEnv === "production") {
    // Ensure logs directory exists to avoid startup failures
    try {
        const logsDir = path.resolve(process.cwd(), "logs")
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    } catch {
        /* best-effort */
    }

    logger.add(
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
    )
    logger.add(
        new winston.transports.File({
            filename: "logs/combined.log",
            format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
    )
}
