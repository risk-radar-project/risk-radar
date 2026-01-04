import type { ApiResponse, LoginEvent } from "./types"
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
