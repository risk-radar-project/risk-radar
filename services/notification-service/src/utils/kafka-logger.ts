import { logLevel } from "kafkajs";
import { logger } from "./logger";
import { config } from "../config/config";

type WinstonLevel = "error" | "warn" | "info" | "debug";
type KafkaLogEntry = {
    level: number;
    namespace?: string;
    log: {
        message: string;
        [key: string]: unknown;
    };
};

type KafkaLogCreator = () => (entry: KafkaLogEntry) => void;

const levelMap: Record<number, WinstonLevel> = {
    [logLevel.ERROR]: "error",
    [logLevel.WARN]: "warn",
    [logLevel.INFO]: "info",
    [logLevel.DEBUG]: "debug",
};

export const kafkaLogCreator: KafkaLogCreator = () => (entry: KafkaLogEntry) => {
    const { level, log, namespace } = entry;
    const { message, ...extra } = log;
    const winstonLevel = levelMap[level] ?? "info";
    const meta = { namespace, ...extra };

    if (!config.logKafkaEvents && (winstonLevel === "info" || winstonLevel === "debug")) {
        return;
    }

    switch (winstonLevel) {
    case "error":
        logger.error(message, meta);
        break;
    case "warn":
        logger.warn(message, meta);
        break;
    case "debug":
        logger.debug(message, meta);
        break;
    default:
        logger.info(message, meta);
        break;
    }
};
