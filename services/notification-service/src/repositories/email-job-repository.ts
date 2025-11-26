import { database } from "../database/database";
import { EmailJob } from "../types/events";
import { config } from "../config/config";

export interface NewEmailJob {
    id: string;
    eventId: string;
    userId?: string;
    recipientEmail: string;
    subject: string;
    body: string;
}

interface EmailJobRow {
    id: string;
    event_id: string;
    user_id: string | null;
    recipient_email: string;
    subject: string;
    body: string;
    status: EmailJob["status"];
    retry_count: number;
    next_retry_at: Date | null;
    last_error: string | null;
    created_at: Date;
    updated_at: Date;
}

class EmailJobRepository {
    async enqueue(job: NewEmailJob): Promise<void> {
        await database.query(
            `INSERT INTO email_jobs (
                 id,
                 event_id,
                 user_id,
                 recipient_email,
                 subject,
                 body,
                 status,
                 retry_count,
                 next_retry_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, NOW())`,
            [
                job.id,
                job.eventId,
                job.userId ?? null,
                job.recipientEmail,
                job.subject,
                job.body
            ]
        );
    }

    async findDueJobs(limit = config.emailSchedulerBatchSize): Promise<EmailJob[]> {
        const result = await database.query<EmailJobRow>(
            `SELECT * FROM email_jobs
             WHERE status IN ('pending', 'failed')
             AND (next_retry_at IS NULL OR next_retry_at <= NOW())
             ORDER BY created_at ASC
             LIMIT $1`,
            [limit]
        );
        return result.rows.map((row: EmailJobRow) => this.mapRow(row));
    }

    async markSent(id: string): Promise<void> {
        await database.query(
            `UPDATE email_jobs
             SET status = 'sent', updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
    }

    async markForRetry(id: string, retryCount: number, nextRetryAt: Date, error: string): Promise<void> {
        await database.query(
            `UPDATE email_jobs
             SET status = 'failed',
                 retry_count = $2,
                 next_retry_at = $3,
                 last_error = $4,
                 updated_at = NOW()
             WHERE id = $1`,
            [id, retryCount, nextRetryAt, error]
        );
    }

    async markDead(id: string, error: string): Promise<void> {
        await database.query(
            `UPDATE email_jobs
             SET status = 'dead', last_error = $2, updated_at = NOW()
             WHERE id = $1`,
            [id, error]
        );
    }

    private mapRow(row: EmailJobRow): EmailJob {
        const job: EmailJob = {
            id: row.id,
            eventId: row.event_id,
            recipientEmail: row.recipient_email,
            subject: row.subject,
            body: row.body,
            status: row.status,
            retryCount: row.retry_count,
            nextRetryAt: row.next_retry_at,
            lastError: row.last_error,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
        if (row.user_id) {
            job.userId = row.user_id;
        }
        return job;
    }
}

export const emailJobRepository = new EmailJobRepository();
