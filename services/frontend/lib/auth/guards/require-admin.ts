import { loadSession } from "../load-session"

export async function requireAdmin() {
    const session = await loadSession()
    if (!session) return false

    const permissions = session.permissions || []

    const hasAdminPermission =
        permissions.includes("*:*") ||
        permissions.includes("PERM_*:*") ||
        permissions.includes("PERM_SYSTEM:ADMIN") ||
        permissions.includes("system:admin")

    return hasAdminPermission
}
