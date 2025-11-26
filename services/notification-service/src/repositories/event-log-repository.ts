import { database } from "../database/database";

class EventLogRepository {
    async isProcessed(eventId: string): Promise<boolean> {
        const result = await database.query<{ event_id: string }>(
            "SELECT event_id FROM event_dispatch_log WHERE event_id = $1",
            [eventId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async markProcessed(eventId: string, eventType: string): Promise<void> {
        await database.query(
            `INSERT INTO event_dispatch_log (event_id, event_type)
             VALUES ($1, $2)
             ON CONFLICT (event_id) DO NOTHING`,
            [eventId, eventType]
        );
    }
}

export const eventLogRepository = new EventLogRepository();
