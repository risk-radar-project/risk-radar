-- media-service initial schema
CREATE TABLE
    IF NOT EXISTS media_assets (
        id UUID PRIMARY KEY,
        owner_id UUID NOT NULL,
        visibility VARCHAR(10) NOT NULL CHECK (visibility IN ('public', 'owner', 'staff')),
        status VARCHAR(10) NOT NULL CHECK (status IN ('approved', 'flagged', 'rejected')),
        is_temporary BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ NULL,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        deleted_at TIMESTAMPTZ NULL,
        content_type VARCHAR(50) NOT NULL,
        size_bytes BIGINT NOT NULL,
        width INT NOT NULL,
        height INT NOT NULL,
        content_hash CHAR(64) NOT NULL,
        original_filename VARCHAR(255) NULL,
        alt TEXT NULL,
        tags JSONB NULL,
        collection VARCHAR(255) NULL,
        moderation_flagged BOOLEAN NULL,
        moderation_decision_time_ms INT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now ()
    );

CREATE INDEX IF NOT EXISTS idx_media_owner ON media_assets (owner_id);

CREATE INDEX IF NOT EXISTS idx_media_status ON media_assets (status);

CREATE INDEX IF NOT EXISTS idx_media_visibility ON media_assets (visibility);

CREATE INDEX IF NOT EXISTS idx_media_hash ON media_assets (content_hash);

CREATE INDEX IF NOT EXISTS idx_media_created ON media_assets (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_temporary_expiry ON media_assets (is_temporary, expires_at);