import { database } from "../database/database";
import { NotificationRule } from "../types/events";

type JsonValue<T> = T | string;

interface RuleRow {
    id: string;
    event_type: NotificationRule["eventType"];
    audience: NotificationRule["audience"];
    channels: JsonValue<NotificationRule["channels"]>;
    template_mappings: JsonValue<NotificationRule["templateMappings"]>;
    is_active: boolean;
}

function parseJsonColumn<T>(value: JsonValue<T>): T {
    if (typeof value === "string") {
        return JSON.parse(value) as T;
    }
    return value as T;
}

class NotificationRuleRepository {
    async findByEvent(eventType: NotificationRule["eventType"]): Promise<NotificationRule | null> {
        const result = await database.query<RuleRow>(
            `SELECT id, event_type, audience, channels, template_mappings, is_active
             FROM notification_rules
             WHERE event_type = $1`,
            [eventType]
        );

        if (result.rowCount === 0) {
            return null;
        }

        const row = result.rows[0];
        if (!row) {
            return null;
        }
        if (!row.is_active) {
            return null;
        }

        const channels = parseJsonColumn<NotificationRule["channels"]>(row.channels);
        const templateMappings = parseJsonColumn<NotificationRule["templateMappings"]>(row.template_mappings);

        return {
            id: row.id,
            eventType: row.event_type,
            audience: row.audience,
            channels,
            templateMappings,
            isActive: row.is_active,
        };
    }
}

export const notificationRuleRepository = new NotificationRuleRepository();
