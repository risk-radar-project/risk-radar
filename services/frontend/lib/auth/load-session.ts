import { getServerSession } from "./session"
import type { SessionUser } from "./session"

// Placeholder: in the future we will fetch user session from API gateway
export async function loadSession(): Promise<SessionUser> {
    return await getServerSession() // currently returns null
}
