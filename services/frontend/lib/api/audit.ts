import type { ApiResponse, LoginEvent, AuditLogFilters, AuditLogResponse } from "./types"
import { isTokenExpired } from "@/lib/auth/jwt-utils"
import { refreshAccessToken } from "@/lib/auth/auth-service"

// Use Next.js Route Handlers as BFF - all requests go through /api/admin/audit
// This ensures consistent routing and proper server-side proxying
const AUDIT_API_BASE = "/api/admin/audit"

async function getFreshAccessToken(): Promise<string | null> {
    if (typeof window === "undefined") return null

    const accessToken = localStorage.getItem("access_token")
    const refreshToken = localStorage.getItem("refresh_token")

    if (accessToken && !isTokenExpired(accessToken)) {
        return accessToken
    }

    if (!refreshToken) return null

    const refreshed = await refreshAccessToken(refreshToken)
    if (refreshed?.accessToken) {
        localStorage.setItem("access_token", refreshed.accessToken)
        if (refreshed.refreshToken) {
            localStorage.setItem("refresh_token", refreshed.refreshToken)
        }
        return refreshed.accessToken
    }

    return null
}

export async function getAuditLogs(filters: AuditLogFilters): Promise<ApiResponse<AuditLogResponse>> {
    const token = await getFreshAccessToken()
    if (!token) {
        return {
            data: {
                data: [],
                pagination: { page: 1, pageSize: 0, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
            },
            error: "Not authenticated"
        }
    }

    // Build URL with query parameters
    const params = new URLSearchParams()
    if (filters.service) params.set("service", filters.service)
    if (filters.action) params.set("action", filters.action)
    if (filters.actor_id) params.set("actor_id", filters.actor_id)
    if (filters.status) params.set("status", filters.status)
    if (filters.log_type) params.set("log_type", filters.log_type)
    if (filters.start_date) params.set("start_date", filters.start_date)
    if (filters.end_date) params.set("end_date", filters.end_date)
    if (filters.page) params.set("page", String(filters.page))
    if (filters.limit) params.set("limit", String(filters.limit))
    if (filters.sort_by) params.set("sort_by", filters.sort_by)
    if (filters.order) params.set("order", filters.order)

    const url = `${AUDIT_API_BASE}?${params.toString()}`

    const response = await fetch(url, {
        cache: "no-store",
        headers: {
            Authorization: `Bearer ${token}`
        }
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się pobrać logów audytowych"
        try {
            const body = await response.json()
            errorMessage = body.error ?? body.message ?? errorMessage
        } catch {
            /* ignore */
        }
        return {
            data: {
                data: [],
                pagination: { page: 1, pageSize: 0, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
            },
            error: errorMessage
        }
    }

    const data = (await response.json()) as AuditLogResponse
    return { data }
}

export async function getLoginHistory(actorId: string, limit = 10): Promise<ApiResponse<LoginEvent[]>> {
    const token = await getFreshAccessToken()
    if (!token) {
        return { data: [], error: "Not authenticated" }
    }

    const params = new URLSearchParams()
    params.set("actor_id", actorId)
    params.set("limit", String(limit))

    const url = `${AUDIT_API_BASE}/login-history?${params.toString()}`

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się pobrać historii logowań"
        try {
            const body = await response.json()
            errorMessage = body.error ?? body.message ?? errorMessage
        } catch {
            /* ignore */
        }
        return { data: [], error: errorMessage }
    }

    const data = (await response.json()) as LoginEvent[]
    return { data }
}
