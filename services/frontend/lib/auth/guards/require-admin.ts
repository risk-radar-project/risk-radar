import { loadSession } from "../load-session"

export async function requireAdmin() {
    const session = await loadSession()
    const roles = session?.roles || []
    const isAdmin = roles.includes("admin")
    return isAdmin
}
