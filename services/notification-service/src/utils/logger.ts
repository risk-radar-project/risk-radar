import winston from "winston";
import { config } from "../config/config";

function getColorCode(level: string): number {
    switch (level) {
    case "error": return 31; // red
    case "warn": return 33; // yellow
    case "info": return 32; // green
    case "debug": return 90; // grey
    case "verbose": return 36; // cyan
    case "silly": return 35; // magenta
    default: return 37; // white
    }
}

export const logger = winston.createLogger({
    level: config.logLevel,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                winston.format.printf((info) => {
                    const { timestamp, level, message, ...args } = info as Record<string, unknown>;
                    const argsString = Object.keys(args).length > 0
                        ? " " + JSON.stringify(args)
                        : "";
                    const colorCode = getColorCode(level as string);
                    if (level === "debug") {
                        return `[${timestamp}] \x1b[${colorCode}m${level}: ${message}${argsString}\x1b[0m`;
                    } else {
                        return `[${timestamp}] \x1b[${colorCode}m${level}\x1b[0m: ${message}${argsString}`;
                    }
                })
            ),
        }),
    ],
});

if (config.nodeEnv === "production") {
    logger.add(new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }));
    logger.add(new winston.transports.File({
        filename: "logs/combined.log",
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }));
}
