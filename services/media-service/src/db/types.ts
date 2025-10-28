/** Access scope for asset visibility. */
export type Visibility = "public" | "owner" | "staff"
/** Moderation workflow status for an asset. */
export type ModerationStatus = "approved" | "flagged" | "rejected"

/** Row shape of media_assets table. */
export interface MediaEntity {
    id: string
    owner_id: string
    visibility: Visibility
    status: ModerationStatus
    deleted: boolean
    deleted_at: string | null
    is_temporary: boolean
    expires_at: string | null
    is_censored: boolean
    censor_strength: number | null
    censored_at: string | null
    content_type: string
    size_bytes: number
    width: number
    height: number
    content_hash: string
    original_filename: string | null
    alt: string | null
    tags: any | null // JSONB
    collection: string | null
    moderation_flagged: boolean | null
    moderation_decision_time_ms: number | null
    created_at: string
    updated_at: string
}
