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
            console.error("Failed to verify report:", res.status, await res.text())
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
            console.error("Failed to reject report:", res.status, await res.text())
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
