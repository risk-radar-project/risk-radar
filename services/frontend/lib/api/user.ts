import type { ApiResponse, User } from "./types"
import { getFreshAccessToken } from "@/lib/auth/auth-service"

// Fetch current user profile from backend
export async function getUserProfile(): Promise<ApiResponse<User>> {
    const token = await getFreshAccessToken()

    if (!token) {
        return {
            data: { id: "", email: "", username: "", roles: [], permissions: [] },
            error: "Not authenticated"
        }
    }

    const response = await fetch(`/api/me`, {
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
    const response = await fetch(`/api/forgot-password`, {
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
            // We ignore backend error messages here for security/UX reasons (prefer generic Polish messages)
            // or map them if strictly necessary. For now, generic Polish error.
            const err = body.error ?? body.message
            if (err && String(err).includes("not found")) {
                errorMessage = "Nie znaleziono użytkownika o podanym adresie email"
            } else if (err) {
                // Keep generic or basic mapping
            }
        } catch {
            // ignore JSON parse failures
        }
        return { data: { message: "" }, error: errorMessage }
    }

    // Always return Polish message for success, ignore backend English response
    return { data: { message: "Link resetujący został wysłany (sprawdź email)" } }
}

export async function changeEmail(newEmail: string): Promise<ApiResponse<void>> {
    const token = await getFreshAccessToken()
    if (!token) return { data: undefined as unknown as void, error: "Not authenticated" }

    const response = await fetch(`/api/change-email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newEmail })
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się zmienić adresu email"
        let demoMode = false
        try {
            const body = await response.json()
            if (body.demo_mode || body.error?.includes?.("demo")) {
                demoMode = true
            }
            if (body.error && typeof body.error === "object") {
                errorMessage = body.error.message || "Wystąpił błąd"
            } else {
                errorMessage = body.error ?? body.message ?? errorMessage
            }
        } catch {
            // ignore
        }
        return { data: undefined as unknown as void, error: errorMessage, demo_mode: demoMode }
    }

    return { data: undefined as unknown as void }
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    const response = await fetch(`/api/reset-password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ token, newPassword })
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się zresetować hasła"
        try {
            const body = await response.json()
            const err = body.error ?? body.message
            if (err && String(err).includes("Invalid or expired")) {
                errorMessage = "Link jest nieprawidłowy lub wygasł"
            } else if (err && String(err).includes("New password cannot be the same")) {
                errorMessage = "Nowe hasło nie może być takie samo jak poprzednie"
            }
        } catch {
            // ignore
        }
        return { data: { message: "" }, error: errorMessage }
    }

    // Return hardcoded Polish message
    return { data: { message: "Hasło zostało pomyślnie zresetowane" } }
}

export async function validateResetToken(token: string): Promise<ApiResponse<{ valid: boolean }>> {
    const response = await fetch(`/api/validate-reset-token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ token })
    })

    if (!response.ok) {
        return { data: { valid: false }, error: "Token jest nieprawidłowy lub wygasł" }
    }

    return { data: { valid: true } }
}
