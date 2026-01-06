import type { ApiResponse, User } from "./types"
import { API_BASE_URL, getFreshAccessToken } from "@/lib/auth/auth-service"

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

export async function changeEmail(newEmail: string): Promise<ApiResponse<void>> {
    const token = await getFreshAccessToken()
    if (!token) return { data: undefined as unknown as void, error: "Not authenticated" }

    const response = await fetch(`${API_BASE_URL}/change-email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newEmail })
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się zmienić adresu email"
        try {
            const body = await response.json()
            if (body.error && typeof body.error === "object") {
                errorMessage = body.error.message || "Wystąpił błąd"
            } else {
                errorMessage = body.error ?? body.message ?? errorMessage
            }
        } catch {
            // ignore
        }
        return { data: undefined as unknown as void, error: errorMessage }
    }

    return { data: undefined as unknown as void }
}
