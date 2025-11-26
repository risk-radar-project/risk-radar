import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const sendMailMock = jest.fn() as jest.MockedFunction<(payload: unknown) => Promise<void>>;
const verifyMock = jest.fn() as jest.MockedFunction<() => Promise<boolean>>;

jest.mock("nodemailer", () => ({
    createTransport: jest.fn(() => ({
        sendMail: sendMailMock,
        verify: verifyMock,
    })),
}));

const loggerMock = {
    info: jest.fn(),
    warn: jest.fn(),
};

const mockConfig = {
    smtpHost: "mailpit",
    smtpPort: 2525,
    smtpUser: "user",
    smtpPassword: "pass",
    mailFrom: "Risk Radar <no-reply@riskradar.local>",
};

jest.mock("../../../src/config/config", () => ({
    config: mockConfig,
}));

jest.mock("../../../src/utils/logger", () => ({
    logger: loggerMock,
}));

import { emailDeliveryService } from "../../../src/services/email-delivery";

describe("emailDeliveryService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("sends email jobs with configured defaults", async () => {
        sendMailMock.mockResolvedValue(undefined);
        const job = {
            id: "job-1",
            eventId: "evt-1",
            userId: "user-1",
            recipientEmail: "user@example.com",
            subject: "Subject",
            body: "<p>Body</p>",
            status: "pending",
            retryCount: 0,
            nextRetryAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as const;

        await emailDeliveryService.send(job);

        expect(sendMailMock).toHaveBeenCalledWith({
            from: mockConfig.mailFrom,
            to: job.recipientEmail,
            subject: job.subject,
            html: job.body,
        });
        expect(loggerMock.info).toHaveBeenCalledWith("Email dispatched", {
            jobId: "job-1",
            recipient: "user@example.com",
        });
    });

    it("verifies SMTP connection", async () => {
        verifyMock.mockResolvedValue(true);

        const healthy = await emailDeliveryService.verifyConnection();

        expect(healthy).toBe(true);
        expect(verifyMock).toHaveBeenCalled();
    });

    it("logs warning and returns false when SMTP verify fails", async () => {
        verifyMock.mockRejectedValue(new Error("offline"));

        const healthy = await emailDeliveryService.verifyConnection();

        expect(healthy).toBe(false);
        expect(loggerMock.warn).toHaveBeenCalledWith("SMTP verify failed", { error: "offline" });
    });
});
