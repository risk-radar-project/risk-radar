export const API_BASE_URL = "http://localhost:8090/api/users"

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
