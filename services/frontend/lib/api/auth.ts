import { apiFetch } from "./fetcher"
import type { ApiResponse, User } from "./types"

// Placeholder: authenticate user
export async function login(input: { email: string; password: string }): Promise<ApiResponse<User>> {
    return { data: { id: "1", email: input.email, username: "placeholder", roles: ["user"] } }
}

// Placeholder: register new user
export async function register(input: { email: string; password: string; username: string }): Promise<ApiResponse<User>> {
    return { data: { id: "1", email: input.email, username: input.username, roles: ["user"] } }
}

// Placeholder: get the current user session
export async function getCurrentUser(): Promise<ApiResponse<User | null>> {
    return { data: null }
}
