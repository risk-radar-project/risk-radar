import type { ApiResponse, Report } from "./types"

// Placeholder: fetch user's own reports
export async function getMyReports(): Promise<ApiResponse<Report[]>> {
    return {
        data: []
    }
}

// Placeholder: fetch report details
export async function getReport(id: string): Promise<ApiResponse<Report>> {
    return {
        data: {
            id,
            title: "Placeholder Report",
            description: "Mock report description",
            status: "pending",
            createdAt: new Date().toISOString()
        }
    }
}
