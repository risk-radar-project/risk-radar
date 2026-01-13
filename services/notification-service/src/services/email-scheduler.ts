import { config } from "../config/config";
import { emailJobRepository } from "../repositories/email-job-repository";
import { emailDeliveryService } from "./email-delivery";
import { auditClient } from "../clients/audit-client";
import { logger } from "../utils/logger";
import { EmailJob } from "../types/events";
import { hashEmail, maskEmail } from "../utils/privacy";

/**
 * Scheduler for processing pending email jobs.
 * Polls the database for due jobs and processes them in batches with concurrency support.
 */
export class EmailScheduler {
    private timer: NodeJS.Timeout | null = null;
    private running = false;

    /**
     * Starts the email scheduler.
     * Sets up a timer to poll for jobs at configured intervals.
     */
    start(): void {
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            void this.tick();
        }, config.emailPollIntervalMs);
        void this.tick();
        logger.debug("Email scheduler started", { interval: config.emailPollIntervalMs });
    }

    /**
     * Stops the email scheduler.
     * Clears the polling timer.
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async tick(): Promise<void> {
        if (this.running) {
            return;
        }
        this.running = true;
        try {
            const jobs = await emailJobRepository.findDueJobs(config.emailSchedulerBatchSize);
            if (jobs.length === 0) {
                return;
            }
            logger.debug("Email scheduler processing batch", {
                batchSize: jobs.length,
                concurrency: config.emailSchedulerConcurrency
            });
            await this.processJobsWithConcurrency(jobs);
        } catch (error) {
            logger.error("Email scheduler tick failed", { error });
        } finally {
            this.running = false;
        }
    }

    private async processJobsWithConcurrency(jobs: EmailJob[]): Promise<void> {
        const concurrency = Math.max(1, config.emailSchedulerConcurrency);
        for (let index = 0; index < jobs.length; index += concurrency) {
            const batch = jobs.slice(index, index + concurrency);
            await Promise.all(batch.map((job) => this.processJob(job)));
        }
    }

    private async processJob(job: EmailJob): Promise<void> {
        try {
            await emailDeliveryService.send(job);
            await emailJobRepository.markSent(job.id);
            await auditClient.recordNotification({
                eventId: job.eventId,
                channel: "email",
                status: "sent",
                ...(job.userId ? { userId: job.userId } : {}),
                metadata: {
                    recipientEmailHash: hashEmail(job.recipientEmail),
                    recipientEmailMasked: maskEmail(job.recipientEmail)
                }
            });
        } catch (error) {
            logger.error("Email sending failed", {
                jobId: job.id,
                error: error instanceof Error ? error.message : "unknown error"
            });
            await this.scheduleRetry(job, error instanceof Error ? error.message : "unknown error");
        }
    }

    private async scheduleRetry(job: EmailJob, errorMessage: string): Promise<void> {
        const nextDelay = config.emailRetryDelays[job.retryCount];
        if (nextDelay) {
            const nextRetryAt = new Date(Date.now() + nextDelay);
            await emailJobRepository.markForRetry(job.id, job.retryCount + 1, nextRetryAt, errorMessage);
            await auditClient.recordNotification({
                eventId: job.eventId,
                channel: "email",
                status: "failed",
                ...(job.userId ? { userId: job.userId } : {}),
                metadata: { retryScheduledAt: nextRetryAt.toISOString() }
            });
        } else {
            await emailJobRepository.markDead(job.id, errorMessage);
            await auditClient.recordNotification({
                eventId: job.eventId,
                channel: "email",
                status: "failed",
                ...(job.userId ? { userId: job.userId } : {}),
                metadata: { deadLetter: true, reason: errorMessage }
            });
        }
    }
}

export const emailScheduler = new EmailScheduler();
