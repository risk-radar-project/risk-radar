import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config/config";
import { EmailJob } from "../types/events";
import { logger } from "../utils/logger";

class EmailDeliveryService {
    private transporter: Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort,
            secure: false,
            auth: config.smtpUser && config.smtpPassword ? {
                user: config.smtpUser,
                pass: config.smtpPassword,
            } : undefined,
        });
    }

    async send(job: EmailJob): Promise<void> {
        await this.transporter.sendMail({
            from: config.mailFrom,
            to: job.recipientEmail,
            subject: job.subject,
            html: job.body,
        });
        logger.info("Email dispatched", { jobId: job.id, recipient: job.recipientEmail });
    }

    async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            logger.warn("SMTP verify failed", {
                error: error instanceof Error ? error.message : "unknown error"
            });
            return false;
        }
    }
}

export const emailDeliveryService = new EmailDeliveryService();
