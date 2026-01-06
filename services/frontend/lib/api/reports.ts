import { apiFetch } from "./fetcher"
import type { ApiResponse, Report } from "./types"
import { getFreshAccessToken, REPORTS_API_URL } from "@/lib/auth/auth-service"

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

    const data = await apiFetch<{ content: Report[]; totalElements: number; totalPages: number }>(
        `${REPORTS_API_URL}/my-reports?${params.toString()}`,
        {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
    )
    return { data }
}

// Fetch report details
export async function getReport(id: string): Promise<ApiResponse<Report>> {
    const data = await apiFetch<Report>(`${REPORTS_API_URL}/${id}`)
    return { data }
}

// Update a report
export async function updateReport(
    id: string,
    data: { title: string; description: string; category?: string }
): Promise<ApiResponse<Report>> {
    const token = await getFreshAccessToken()
    const updated = await apiFetch<Report>(`${REPORTS_API_URL}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    return { data: updated }
}

// Delete a report
export async function deleteReport(id: string): Promise<ApiResponse<void>> {
    const token = await getFreshAccessToken()
    await apiFetch<void>(`${REPORTS_API_URL}/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    return { data: undefined as unknown as void }
}
