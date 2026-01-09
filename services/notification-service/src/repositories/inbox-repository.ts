import { database } from "../database/database";
import { InboxNotification, NotificationEvent } from "../types/events";

export interface NewInboxEntry {
    id: string;
    userId: string;
    eventId: string;
    eventType: NotificationEvent["eventType"];
    title: string;
    body: string;
    metadata?: Record<string, unknown> | undefined;
}

interface InboxRow {
    id: string;
    user_id: string;
    event_id: string;
    event_type: NotificationEvent["eventType"];
    title: string;
    body: string;
    metadata: Record<string, unknown> | null;
    is_read: boolean;
    read_at: Date | null;
    created_at: Date;
}

class InboxRepository {
    async create(entry: NewInboxEntry): Promise<string> {
        const result = await database.query<{ id: string }>(
            `INSERT INTO notifications_inbox (id, user_id, event_id, event_type, title, body, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
                entry.id,
                entry.userId,
                entry.eventId,
                entry.eventType,
                entry.title,
                entry.body,
                entry.metadata ?? {},
            ]
        );
        const inserted = result.rows[0];
        if (!inserted) {
            throw new Error("Failed to persist inbox notification");
        }
        return inserted.id;
    }

    async countByUser(userId: string, isRead?: boolean): Promise<number> {
        const params: (string | boolean)[] = [userId];
        let query = "SELECT COUNT(*) as count FROM notifications_inbox WHERE user_id = $1";
        
        if (typeof isRead === "boolean") {
            params.push(isRead);
            query += ` AND is_read = $${params.length}`;
        }
        
        const result = await database.query<{ count: string | number }>(query, params);
        if (result.rows.length === 0) return 0;
        const row = result.rows[0];
        return Number(row?.count || 0);
    }

    async listByUser(
        userId: string,
        limit: number,
        offset: number,
        isRead?: boolean
    ): Promise<InboxNotification[]> {
        const params: (string | number | boolean)[] = [userId];
        const selectClause = "SELECT id, user_id, event_id, event_type, title, body, "
            + "metadata, is_read, read_at, created_at";
        let query = [
            selectClause,
            "FROM notifications_inbox",
            "WHERE user_id = $1"
        ].join(" ");
        if (typeof isRead === "boolean") {
            params.push(isRead);
            query += ` AND is_read = $${params.length}`;
        }
        const limitIndex = params.push(limit);
        const offsetIndex = params.push(offset);
        query += " ORDER BY created_at DESC LIMIT $" + limitIndex + " OFFSET $" + offsetIndex;

        const result = await database.query<InboxRow>(query, params);
        return result.rows.map((row: InboxRow) => {
            const notification: InboxNotification = {
                id: row.id,
                userId: row.user_id,
                eventId: row.event_id,
                eventType: row.event_type,
                title: row.title,
                body: row.body,
                isRead: row.is_read,
                createdAt: row.created_at,
            };
            if (row.read_at) {
                notification.readAt = row.read_at;
            }
            if (row.metadata) {
                notification.metadata = row.metadata;
            }
            return notification;
        });
    }

    async markAsRead(id: string, userId: string): Promise<boolean> {
        const result = await database.query<{ updated: number }>(
            `UPDATE notifications_inbox
             SET is_read = true, read_at = NOW()
             WHERE id = $1 AND user_id = $2 AND is_read = false
             RETURNING 1 AS updated`,
            [id, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async markAsUnread(id: string, userId: string): Promise<boolean> {
        const result = await database.query<{ updated: number }>(
            `UPDATE notifications_inbox
             SET is_read = false, read_at = NULL
             WHERE id = $1 AND user_id = $2 AND is_read = true
             RETURNING 1 AS updated`,
            [id, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }
}

export const inboxRepository = new InboxRepository();
