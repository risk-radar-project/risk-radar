import { loadSession } from "../load-session"

export async function requireAdmin() {
    const session = await loadSession()
    if (!session) return false

    const roles = (session.roles || []).map((r) => r.toUpperCase())
    const permissions = session.permissions || []

    const hasAdminRole = roles.includes("ADMIN") || roles.includes("ROLE_ADMIN")
    const hasAdminPermission =
        permissions.includes("*:*") ||
        permissions.includes("PERM_*:*") ||
        permissions.includes("PERM_SYSTEM:ADMIN") ||
        permissions.includes("system:admin")

    return hasAdminRole || hasAdminPermission
}
