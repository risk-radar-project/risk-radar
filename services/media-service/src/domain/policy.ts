import { ModerationStatus, Visibility } from "../db/types.js"
import { hasPermission } from "../authz/authz-adapter.js"
import { Permissions } from "../authz/permissions.js"

/** Determine if requester may view the master/original asset. */
export async function canViewMaster(
    userId: string | undefined,
    ownerId: string,
    status: ModerationStatus,
    visibility: Visibility
): Promise<boolean> {
    if (!userId) return visibility === "public" && status === "approved"
    if (userId === ownerId) return true
    if (await hasPermission(userId, Permissions.READ_ALL)) return true
    if (visibility === "public" && status === "approved") return true
    return false
}

/** Check moderation permission. */
export async function canModerate(userId: string | undefined): Promise<boolean> {
    if (!userId) return false
    return hasPermission(userId, Permissions.MODERATE)
}

/** Check censor (manual image alteration) permission. */
export async function canCensor(userId: string | undefined): Promise<boolean> {
    if (!userId) return false
    return hasPermission(userId, Permissions.CENSOR)
}

/** Check delete permission. */
export async function canDelete(userId: string | undefined): Promise<boolean> {
    if (!userId) return false
    return hasPermission(userId, Permissions.DELETE)
}

/** Check ability to update assets of other users. */
export async function canUpdateOthers(userId: string | undefined): Promise<boolean> {
    if (!userId) return false
    return hasPermission(userId, Permissions.UPDATE)
}
