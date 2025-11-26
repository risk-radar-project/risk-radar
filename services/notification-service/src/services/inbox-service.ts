import { inboxRepository } from "../repositories/inbox-repository";
import { InboxNotification } from "../types/events";

class InboxService {
    async list(userId: string, page: number, limit: number, isRead?: boolean): Promise<InboxNotification[]> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const offset = (safePage - 1) * safeLimit;
        return inboxRepository.listByUser(userId, safeLimit, offset, isRead);
    }

    async markAsRead(id: string, userId: string): Promise<boolean> {
        return inboxRepository.markAsRead(id, userId);
    }

    async markAsUnread(id: string, userId: string): Promise<boolean> {
        return inboxRepository.markAsUnread(id, userId);
    }
}

export const inboxService = new InboxService();
