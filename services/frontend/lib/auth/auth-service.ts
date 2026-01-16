import { isTokenExpired } from "@/lib/auth/jwt-utils"

// Client-side gateway URL for browser-initiated requests (login, refresh, WebSocket)
// Only use for operations that MUST go directly to gateway from browser
export const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8090"

// API URLs - most API calls should use Next.js Route Handlers (/api/...)
// These are kept for backward compatibility with components that haven't been migrated
export const API_BASE_URL = `${GATEWAY_URL}/api`
export const REPORTS_API_URL = `${GATEWAY_URL}/api/reports`
export const MEDIA_API_URL = `${GATEWAY_URL}/api/media`
export const NOTIFICATIONS_API_URL = `${GATEWAY_URL}/api/notifications`

export async function getFreshAccessToken(): Promise<string | null> {
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

export async function refreshAccessToken(
    refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
        // Use local Next.js route handler for production-ready deployment
        const response = await fetch(`/api/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ refreshToken })
        })

        if (response.ok) {
            const data = await response.json()
            // Handle both camelCase and snake_case just in case
            const newAccessToken = data.accessToken || data.access_token || data.token
            const newRefreshToken = data.refreshToken || data.refresh_token

            return { accessToken: newAccessToken, refreshToken: newRefreshToken }
        }
        return null
    } catch (error) {
        console.error("Failed to refresh token", error)
        return null
    }
}

export function logout() {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    // Optionally call logout endpoint
    window.location.href = "/login"
}
