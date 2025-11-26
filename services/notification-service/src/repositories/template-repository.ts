import { database } from "../database/database";
import { NotificationChannel, NotificationEvent, NotificationTemplate } from "../types/events";

interface TemplateRow {
    id: string;
    template_key: string;
    event_type: NotificationEvent["eventType"];
    channel: NotificationChannel;
    title: string | null;
    subject: string | null;
    body: string;
}

class TemplateRepository {
    async findByKey(templateKey: string): Promise<NotificationTemplate | null> {
        const result = await database.query<TemplateRow>(
            `SELECT id, template_key, event_type, channel, title, subject, body
             FROM notification_templates
             WHERE template_key = $1`,
            [templateKey]
        );

        if (result.rowCount === 0) {
            return null;
        }

        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return {
            id: row.id,
            templateKey: row.template_key,
            eventType: row.event_type,
            channel: row.channel,
            title: row.title,
            subject: row.subject,
            body: row.body,
        };
    }
}

export const templateRepository = new TemplateRepository();
