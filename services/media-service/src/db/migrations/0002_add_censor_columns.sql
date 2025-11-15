-- Add columns to track censorship state and parameters
ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS is_censored boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS censor_strength integer NULL,
    ADD COLUMN IF NOT EXISTS censored_at timestamp with time zone NULL;

-- Set automatic timestamp on censor state change via trigger could be added later; for now handled in app
