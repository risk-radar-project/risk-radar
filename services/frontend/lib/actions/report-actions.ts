"use server"

import { revalidatePath } from "next/cache"

const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || "http://127.0.0.1:8085"

export async function verifyReport(reportId: string, token: string) {
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
