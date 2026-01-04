"use server"

import { revalidatePath } from "next/cache"

const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || "http://report-service:8080"

export async function verifyReport(reportId: string) {
    console.log(`Verifying report ${reportId}...`)
    try {
        const res = await fetch(`${REPORT_SERVICE_URL}/report/${reportId}/status?status=VERIFIED`, {
            method: "PATCH"
        })

        if (!res.ok) {
            console.error("Failed to verify report:", res.status, await res.text())
            return { success: false, error: "Failed to verify report" }
        }

        revalidatePath("/reports")
        return { success: true }
    } catch (error) {
        console.error("Error verifying report:", error)
        return { success: false, error: "Connection error" }
    }
}

export async function rejectReport(reportId: string) {
    console.log(`Rejecting report ${reportId}...`)
    try {
        const res = await fetch(`${REPORT_SERVICE_URL}/report/${reportId}/status?status=REJECTED`, {
            method: "PATCH"
        })

        if (!res.ok) {
            console.error("Failed to reject report:", res.status, await res.text())
            return { success: false, error: "Failed to reject report" }
        }

        revalidatePath("/reports")
        return { success: true }
    } catch (error) {
        console.error("Error rejecting report:", error)
        return { success: false, error: "Connection error" }
    }
}
