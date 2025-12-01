import type { ApiResponse, User } from "./types"

// Placeholder: fetch user profile
export async function getUserProfile(): Promise<ApiResponse<User>> {
    return {
        data: {
            id: "1",
            email: "placeholder@example.com",
            username: "placeholder_user",
            roles: ["user"]
        }
    }
}
