export interface Migration {
    id: string;
    name: string;
    up: string;
}

export const initialMigration: Migration = {
    id: "001_initial",
    name: "create notification tables",
    up: `
        CREATE TABLE IF NOT EXISTS notification_service_migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notification_templates (
            id UUID PRIMARY KEY,
            template_key TEXT NOT NULL UNIQUE,
            event_type TEXT NOT NULL,
            channel TEXT NOT NULL,
            title TEXT,
            subject TEXT,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notification_rules (
            id UUID PRIMARY KEY,
            event_type TEXT NOT NULL UNIQUE,
            audience TEXT NOT NULL,
            channels JSONB NOT NULL,
            template_mappings JSONB NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notifications_inbox (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            event_id UUID NOT NULL,
            event_type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            read_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_inbox_user
            ON notifications_inbox (user_id, is_read, created_at DESC);

        CREATE TABLE IF NOT EXISTS email_jobs (
            id UUID PRIMARY KEY,
            event_id UUID NOT NULL,
            user_id UUID,
            recipient_email TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            retry_count INT NOT NULL DEFAULT 0,
            next_retry_at TIMESTAMPTZ,
            last_error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_email_jobs_status_next_retry
            ON email_jobs (status, next_retry_at);

        CREATE TABLE IF NOT EXISTS event_dispatch_log (
            event_id UUID PRIMARY KEY,
            event_type TEXT NOT NULL,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `,
};
