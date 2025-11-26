/* eslint-disable quotes */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotificationEvent, NotificationRule, NotificationTemplate } from '../../src/types/events';

const mockNotificationRuleRepository = {
    findByEvent: jest.fn<(eventType: NotificationRule['eventType']) => Promise<NotificationRule | null>>()
};
const mockTemplateRepository = {
    findByKey: jest.fn<(key: string) => Promise<NotificationTemplate | null>>()
};
const mockInboxRepository = {
    create: jest.fn<(entry: unknown) => Promise<string>>()
};
const mockEmailJobRepository = {
    enqueue: jest.fn<(job: unknown) => Promise<void>>()
};
const mockEventLogRepository = {
    isProcessed: jest.fn<(eventId: string) => Promise<boolean>>(),
    markProcessed: jest.fn<(eventId: string, eventType: string) => Promise<void>>()
};
const mockUserServiceClient = {
    getUserEmail: jest.fn<(userId: string) => Promise<string | null>>()
};
const mockAuditClient = {
    recordNotification: jest.fn<(payload: unknown) => Promise<void>>()
};

jest.mock('../../src/repositories/notification-rule-repository', () => ({
    notificationRuleRepository: mockNotificationRuleRepository
}));
jest.mock('../../src/repositories/template-repository', () => ({
    templateRepository: mockTemplateRepository
}));
jest.mock('../../src/repositories/inbox-repository', () => ({
    inboxRepository: mockInboxRepository
}));
jest.mock('../../src/repositories/email-job-repository', () => ({
    emailJobRepository: mockEmailJobRepository
}));
jest.mock('../../src/repositories/event-log-repository', () => ({
    eventLogRepository: mockEventLogRepository
}));
jest.mock('../../src/clients/user-service-client', () => ({
    userServiceClient: mockUserServiceClient
}));
jest.mock('../../src/clients/audit-client', () => ({
    auditClient: mockAuditClient
}));

// Import after mocks are defined
import { ChannelDispatchError, notificationDispatcher } from '../../src/services/notification-dispatcher';

function createEvent(payload?: Record<string, unknown>): NotificationEvent {
    const base: NotificationEvent = {
        eventId: 'e1',
        eventType: 'USER_REGISTERED',
        userId: '11111111-1111-4111-8111-111111111111',
        initiatorId: null,
        source: 'test'
    };
    return payload ? { ...base, payload } : base;
}

const templateFixtures: Record<string, NotificationTemplate> = {
    USER_REGISTERED_IN_APP: {
        id: 'tpl1',
        templateKey: 'USER_REGISTERED_IN_APP',
        eventType: 'USER_REGISTERED',
        channel: 'in_app',
        title: 'Hello {{ displayName }}',
        subject: null,
        body: 'Body {{ displayName }}'
    },
    USER_REGISTERED_EMAIL: {
        id: 'tpl2',
        templateKey: 'USER_REGISTERED_EMAIL',
        eventType: 'USER_REGISTERED',
        channel: 'email',
        title: null,
        subject: 'Subject {{ displayName }}',
        body: '<p>Email body</p>'
    }
};

describe('notificationDispatcher', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockEventLogRepository.isProcessed.mockResolvedValue(false);
        mockNotificationRuleRepository.findByEvent.mockResolvedValue({
            id: 'rule1',
            eventType: 'USER_REGISTERED',
            audience: 'user',
            channels: ['in_app', 'email'],
            templateMappings: {
                in_app: 'USER_REGISTERED_IN_APP',
                email: 'USER_REGISTERED_EMAIL'
            },
            isActive: true
        });
        mockTemplateRepository.findByKey.mockImplementation(async (key: string) => templateFixtures[key] ?? null);
        mockUserServiceClient.getUserEmail.mockResolvedValue('fetched@example.com');
        mockAuditClient.recordNotification.mockResolvedValue();
    });

    it('dispatches to all channels and records audit logs', async () => {
        const event = createEvent({ email: 'override@example.com', displayName: 'Marta' });

        await notificationDispatcher.dispatch(event);

        const inboxPayload = mockInboxRepository.create.mock.calls[0]![0] as { userId: string; title: string };
        expect(inboxPayload.userId).toBe(event.userId);
        expect(inboxPayload.title).toBe('Hello Marta');
        const emailPayload = mockEmailJobRepository.enqueue.mock.calls[0]![0] as {
            recipientEmail: string;
            subject: string;
        };
        expect(emailPayload.recipientEmail).toBe('override@example.com');
        expect(emailPayload.subject).toBe('Subject Marta');
        expect(mockUserServiceClient.getUserEmail).not.toHaveBeenCalled();
        expect(mockAuditClient.recordNotification).toHaveBeenCalledTimes(2);
        expect(mockEventLogRepository.markProcessed).toHaveBeenCalledWith(event.eventId, event.eventType);
    });

    it('uses user service fallback when payload lacks email', async () => {
        mockUserServiceClient.getUserEmail.mockResolvedValue('fetched@example.com');
        const event = createEvent({ displayName: 'Jan' });

        await notificationDispatcher.dispatch(event);

        const payload = mockEmailJobRepository.enqueue.mock.calls[0]![0] as { recipientEmail: string };
        expect(payload.recipientEmail).toBe('fetched@example.com');
        expect(mockUserServiceClient.getUserEmail).toHaveBeenCalledWith(event.userId);
        expect(mockEventLogRepository.markProcessed).toHaveBeenCalledWith(event.eventId, event.eventType);
    });

    it('skips already processed events', async () => {
        mockEventLogRepository.isProcessed.mockResolvedValue(true);
        const event = createEvent();

        await notificationDispatcher.dispatch(event);

        expect(mockNotificationRuleRepository.findByEvent).not.toHaveBeenCalled();
        expect(mockEventLogRepository.markProcessed).not.toHaveBeenCalled();
    });

    it('throws when email recipient is missing and halts processed marker', async () => {
        mockUserServiceClient.getUserEmail.mockResolvedValue(null);
        const event = createEvent();

        await expect(notificationDispatcher.dispatch(event)).rejects.toBeInstanceOf(ChannelDispatchError);

        expect(mockEmailJobRepository.enqueue).not.toHaveBeenCalled();
        expect(mockAuditClient.recordNotification).toHaveBeenCalledWith(expect.objectContaining({
            eventId: event.eventId,
            channel: 'email',
            status: 'failed',
            metadata: expect.objectContaining({ reason: 'recipient_email_missing' })
        }));
        expect(mockEventLogRepository.markProcessed).not.toHaveBeenCalled();
    });

    it('throws ChannelDispatchError when any channel fails', async () => {
        mockInboxRepository.create.mockRejectedValue(new Error('db down'));
        const event = createEvent({ email: 'override@example.com' });

        await expect(notificationDispatcher.dispatch(event)).rejects.toBeInstanceOf(ChannelDispatchError);

        expect(mockEmailJobRepository.enqueue).toHaveBeenCalled();
        expect(mockEventLogRepository.markProcessed).not.toHaveBeenCalled();
        expect(mockAuditClient.recordNotification).toHaveBeenCalledWith(expect.objectContaining({
            eventId: event.eventId,
            channel: 'in_app',
            status: 'failed',
            metadata: expect.objectContaining({ reason: 'db down' })
        }));
    });

    it('records audit when rule is missing', async () => {
        mockNotificationRuleRepository.findByEvent.mockResolvedValue(null);
        const event = createEvent();

        await notificationDispatcher.dispatch(event);

        expect(mockAuditClient.recordNotification).toHaveBeenCalledWith(expect.objectContaining({
            eventId: event.eventId,
            channel: 'routing',
            status: 'failed',
            metadata: expect.objectContaining({ reason: 'notification_rule_missing' })
        }));
    });
});
