import type { ApiResponse, User } from "./types"
import { isTokenExpired } from "@/lib/auth/jwt-utils"
import { refreshAccessToken, API_BASE_URL } from "@/lib/auth/auth-service"

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

// Fetch current user profile from backend
export async function getUserProfile(): Promise<ApiResponse<User>> {
    const token = await getFreshAccessToken()

    if (!token) {
        return {
            data: { id: "", email: "", username: "", roles: [], permissions: [] },
            error: "Not authenticated"
        }
    }

    const response = await fetch(`${API_BASE_URL}/me`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się pobrać profilu"
        try {
            const body = await response.json()
            errorMessage = body.error ?? body.message ?? errorMessage
        } catch {
            // ignore parse errors
        }
        return {
            data: { id: "", email: "", username: "", roles: [], permissions: [] },
            error: errorMessage
        }
    }

    const data = (await response.json()) as User
    return { data }
}
// Request a password reset link via API Gateway
export async function requestPasswordReset(email: string): Promise<ApiResponse<{ message: string }>> {
    const response = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się wysłać linku resetującego"
        try {
            const body = await response.json()
            errorMessage = body.error ?? body.message ?? errorMessage
        } catch {
            // ignore JSON parse failures
        }
        return { data: { message: "" }, error: errorMessage }
    }

    let message = "Link resetujący został wysłany"
    try {
        const body = await response.json()
        message = body.message ?? message
    } catch {
        // ignore JSON parse failures
    }

    return { data: { message } }
}
