import type { ApiResponse, LoginEvent, AuditLogFilters, AuditLogResponse } from "./types"
import { isTokenExpired } from "@/lib/auth/jwt-utils"
import { refreshAccessToken } from "@/lib/auth/auth-service"

// Prefer explicit gateway URL when provided; fallback to local gateway port.
const AUDIT_API_BASE = `${process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:8090"}/api/audit`

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

    const url = new URL(`${AUDIT_API_BASE}/logs`)
    if (filters.service) url.searchParams.set("service", filters.service)
    if (filters.action) url.searchParams.set("action", filters.action)
    if (filters.actor_id) url.searchParams.set("actor_id", filters.actor_id)
    if (filters.status) url.searchParams.set("status", filters.status)
    if (filters.log_type) url.searchParams.set("log_type", filters.log_type)
    if (filters.start_date) url.searchParams.set("start_date", filters.start_date)
    if (filters.end_date) url.searchParams.set("end_date", filters.end_date)
    if (filters.page) url.searchParams.set("page", String(filters.page))
    if (filters.limit) url.searchParams.set("limit", String(filters.limit))
    if (filters.sort_by) url.searchParams.set("sort_by", filters.sort_by)
    if (filters.order) url.searchParams.set("order", filters.order)

    const response = await fetch(url.toString(), {
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

    const url = new URL(`${AUDIT_API_BASE}/logs/login-history`)
    url.searchParams.set("actor_id", actorId)
    url.searchParams.set("limit", String(limit))

    const response = await fetch(url.toString(), {
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
