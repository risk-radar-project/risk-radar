export type SessionUser = {
    id: string
    email: string
    username: string
    roles: string[]
    permissions?: string[]
} | null

// Placeholder – backend not implemented yet
export async function getServerSession(): Promise<SessionUser> {
    return null // later: fetch from API Gateway (/auth/me)
}
