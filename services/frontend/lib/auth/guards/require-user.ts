import { loadSession } from "../load-session"

export async function requireUser() {
    const session = await loadSession()
    const hasUser = Boolean(session)
    return hasUser
}
