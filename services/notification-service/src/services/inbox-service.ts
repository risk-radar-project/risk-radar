import { inboxRepository } from "../repositories/inbox-repository";
import { InboxNotification } from "../types/events";

class InboxService {
    async list(
        userId: string,
        page: number,
        limit: number,
        isRead?: boolean
    ): Promise<{ data: InboxNotification[], total: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const offset = (safePage - 1) * safeLimit;
        
        const [data, total] = await Promise.all([
            inboxRepository.listByUser(userId, safeLimit, offset, isRead),
            inboxRepository.countByUser(userId, isRead)
        ]);

        return { data, total };
    }

    async markAsRead(id: string, userId: string): Promise<boolean> {
        return inboxRepository.markAsRead(id, userId);
    }

    async markAsUnread(id: string, userId: string): Promise<boolean> {
        return inboxRepository.markAsUnread(id, userId);
    }
}

export const inboxService = new InboxService();
