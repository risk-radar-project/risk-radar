import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const queryMock = jest.fn() as jest.MockedFunction<(
    query: string,
    params?: unknown[]
) => Promise<{ rows: unknown[]; rowCount?: number }>>;

jest.mock("../../../src/database/database", () => ({
    database: {
        query: queryMock,
    }
}));

const mockConfig = {
    emailSchedulerBatchSize: 25,
};

jest.mock("../../../src/config/config", () => ({
    config: mockConfig,
}));

import { emailJobRepository } from "../../../src/repositories/email-job-repository";

describe("emailJobRepository", () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it("enqueues jobs with default values", async () => {
        await emailJobRepository.enqueue({
            id: "job-1",
            eventId: "evt-1",
            recipientEmail: "user@example.com",
            subject: "Subject",
            body: "Body",
        });

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO email_jobs"),
            expect.arrayContaining([
                "job-1",
                "evt-1",
                null,
                "user@example.com",
                "Subject",
                "Body"
            ])
        );
    });

    it("returns mapped due jobs", async () => {
        const now = new Date();
        queryMock.mockResolvedValue({
            rows: [
                {
                    id: "job-2",
                    event_id: "evt-2",
                    user_id: "user-2",
                    recipient_email: "user2@example.com",
                    subject: "Hello",
                    body: "<p>Hello</p>",
                    status: "pending",
                    retry_count: 1,
                    next_retry_at: now,
                    last_error: "fail",
                    created_at: now,
                    updated_at: now,
                }
            ],
            rowCount: 1,
        });

        const jobs = await emailJobRepository.findDueJobs(10);

        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM email_jobs"), [10]);
        expect(jobs[0]).toEqual(expect.objectContaining({
            id: "job-2",
            eventId: "evt-2",
            userId: "user-2",
            recipientEmail: "user2@example.com",
            status: "pending",
            retryCount: 1,
            nextRetryAt: now,
        }));
    });

    it("updates job states", async () => {
        await emailJobRepository.markSent("job-3");
        await emailJobRepository.markForRetry("job-3", 2, new Date("2025-01-01"), "smtp");
        await emailJobRepository.markDead("job-3", "fatal");

        expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining("status = 'sent'"), ["job-3"]);
        expect(queryMock).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("status = 'failed'"),
            expect.arrayContaining(["job-3", 2, expect.any(Date), "smtp"])
        );
        expect(queryMock).toHaveBeenNthCalledWith(3, expect.stringContaining("status = 'dead'"), ["job-3", "fatal"]);
    });
});
