import type { ApiResponse, User, Report } from "./types"

// Placeholder: list all users
export async function adminListUsers(): Promise<ApiResponse<User[]>> {
    return {
        data: [
            {
                id: "1",
                email: "admin@example.com",
                username: "adminUser",
                roles: ["admin"]
            }
        ]
    }
}

// Placeholder: list all reports
export async function adminListReports(): Promise<ApiResponse<Report[]>> {
    return {
        data: []
    }
}
