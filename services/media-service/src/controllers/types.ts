export type UploadBody = {
    visibility?: "public" | "owner" | "staff"
    alt?: string
}

export type PatchBody = {
    visibility?: "public" | "owner" | "staff"
    alt?: string
    action?: "approve" | "reject" | "flag"
    censor?: { strength?: number }
}
