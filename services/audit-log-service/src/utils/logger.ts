import winston from 'winston';
import { config } from '../config/config';

export const logger = winston.createLogger({
    level: config.logLevel,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.colorize(),
                winston.format.printf((info) => {
                    const { timestamp, level, message, ...args } = info as Record<string, unknown>;
                    const argsString = Object.keys(args).length > 0
                        ? ' ' + JSON.stringify(args)
                        : '';
                    return `[${timestamp}] ${level}: ${message}${argsString}`;
                })
            ),
        }),
    ],
});

if (config.nodeEnv === 'production') {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }));
    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }));
}
