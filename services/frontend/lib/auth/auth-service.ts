import { isTokenExpired } from "@/lib/auth/jwt-utils"

export const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8090"
export const API_BASE_URL = `${GATEWAY_URL}/api/users`
export const REPORTS_API_URL = `${GATEWAY_URL}/api/reports`
export const MEDIA_API_URL = `${GATEWAY_URL}/api/media`

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
        const response = await fetch(`${API_BASE_URL}/refresh`, {
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
