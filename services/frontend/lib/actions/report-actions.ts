"use server"

import { revalidatePath } from "next/cache"

const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || "http://127.0.0.1:8085"
const IS_DEMO_MODE = process.env.DEMO_MODE === "true"

// List of usernames that can bypass demo mode
const DEMO_MODE_BYPASS_USERS = ["superadmin"]

// Extract username from JWT token
function extractUsernameFromToken(token: string): string | null {
    try {
        const parts = token.split(".")
        if (parts.length !== 3) return null
        const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"))
        return payload.sub || payload.username || null
    } catch {
        return null
    }
}

// Check if demo mode should block this action
function isDemoModeBlocked(token: string): boolean {
    if (!IS_DEMO_MODE) return false
    const username = extractUsernameFromToken(token)
    if (username && DEMO_MODE_BYPASS_USERS.includes(username.toLowerCase())) {
        console.log(`[DEMO MODE] Bypass for user: ${username}`)
        return false
    }
    return true
}

export async function verifyReport(reportId: string, token: string) {
    // Check demo mode first
    if (isDemoModeBlocked(token)) {
        return { success: false, error: "demo_mode", demo_mode: true }
    }

    console.log(`Verifying report ${reportId}...`)
    try {
        const res = await fetch(`${REPORT_SERVICE_URL}/report/${reportId}/status?status=VERIFIED`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error("Failed to verify report:", res.status, errorText)
            
            // Check for demo mode response
            try {
                const errorData = JSON.parse(errorText)
                if (errorData.demo_mode || errorData.error?.includes("demo")) {
                    return { success: false, error: "demo_mode", demo_mode: true }
                }
            } catch {
                // Not JSON response
            }
            
            // If the error is 403, it means the user is not authorized
            if (res.status === 403 || res.status === 401) {
                return { success: false, error: "Brak uprawnień do weryfikacji zgłoszeń" }
            }
            return { success: false, error: "Failed to verify report" }
        }

        revalidatePath("/admin/verification")
        revalidatePath("/admin/reports")
        return { success: true }
    } catch (error) {
        console.error("Error verifying report:", error)
        return { success: false, error: "Connection error" }
    }
}

export async function rejectReport(reportId: string, token: string) {
    // Check demo mode first
    if (isDemoModeBlocked(token)) {
        return { success: false, error: "demo_mode", demo_mode: true }
    }

    console.log(`Rejecting report ${reportId}...`)
    try {
        const res = await fetch(`${REPORT_SERVICE_URL}/report/${reportId}/status?status=REJECTED`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error("Failed to reject report:", res.status, errorText)
            
            // Check for demo mode response
            try {
                const errorData = JSON.parse(errorText)
                if (errorData.demo_mode || errorData.error?.includes("demo")) {
                    return { success: false, error: "demo_mode", demo_mode: true }
                }
            } catch {
                // Not JSON response
            }
            
            if (res.status === 403 || res.status === 401) {
                return { success: false, error: "Brak uprawnień do odrzucania zgłoszeń" }
            }
            return { success: false, error: "Failed to reject report" }
        }

        revalidatePath("/admin/verification")
        revalidatePath("/admin/reports")
        return { success: true }
    } catch (error) {
        console.error("Error rejecting report:", error)
        return { success: false, error: "Connection error" }
    }
}
