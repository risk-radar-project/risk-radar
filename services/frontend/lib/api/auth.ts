import type { ApiResponse, User } from "./types"
import { getUserProfile } from "./user"

// Placeholder: authenticate user
export async function login(input: { email: string; password: string }): Promise<ApiResponse<User>> {
    return { data: { id: "1", email: input.email, username: "placeholder", roles: ["user"] } }
}

// Placeholder: register new user
export async function register(input: { email: string; password: string; username: string }): Promise<ApiResponse<User>> {
    return { data: { id: "1", email: input.email, username: input.username, roles: ["user"] } }
}

// Get the current user session (decoded from JWT)
export async function getCurrentUser(): Promise<ApiResponse<User | null>> {
    const profile = await getUserProfile()
    if (profile.error) return { data: null, error: profile.error }
    return { data: profile.data }
}
