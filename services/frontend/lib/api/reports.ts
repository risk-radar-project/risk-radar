import type { ApiResponse, Report } from "./types"
import { getFreshAccessToken } from "@/lib/auth/auth-service"

// Fetch user's own reports
export async function getMyReports(
    page = 0,
    size = 10,
    sort = "createdAt",
    direction = "desc",
    status?: string,
    category?: string
): Promise<ApiResponse<{ content: Report[]; totalElements: number; totalPages: number }>> {
    const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        sort,
        direction
    })

    if (status && status !== "ALL") params.append("status", status)
    if (category && category !== "ALL") params.append("category", category)

    const token = await getFreshAccessToken()

    const response = await fetch(`/api/reports/my-reports?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    })

    if (!response.ok) {
        throw new Error("Failed to fetch reports")
    }

    const data = await response.json()
    return { data }
}

// Fetch report details
export async function getReport(id: string): Promise<ApiResponse<Report>> {
    const response = await fetch(`/api/reports/${id}`)
    if (!response.ok) {
        throw new Error("Failed to fetch report")
    }
    const data = await response.json()
    return { data }
}

// Update a report
export async function updateReport(
    id: string,
    data: { title: string; description: string; category?: string }
): Promise<ApiResponse<Report>> {
    const token = await getFreshAccessToken()
    const response = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data)
    })
    if (!response.ok) {
        throw new Error("Failed to update report")
    }
    const updated = await response.json()
    return { data: updated }
}

// Delete a report
export async function deleteReport(id: string): Promise<ApiResponse<void>> {
    const token = await getFreshAccessToken()
    const response = await fetch(`/api/reports/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok && response.status !== 204) {
        throw new Error("Failed to delete report")
    }
    return { data: undefined as unknown as void }
}
