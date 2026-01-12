"use server"

// This file contains server actions for managing reports, such as verifying or rejecting them.

import { revalidatePath } from "next/cache"

// The URL of the report service, defaults to localhost if not set in environment variables.
const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || "http://127.0.0.1:8085"

/**
 * Verifies a report by sending a PATCH request to the report service.
 * @param reportId - The ID of the report to verify.
 * @param token - The authorization token for the request.
 * @returns An object indicating success or failure.
 */
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
            // If the error is 403 or 401, it means the user is not authorized.
            if (res.status === 403 || res.status === 401) {
                return { success: false, error: "You are not authorized to verify reports." }
            }
            return { success: false, error: "Failed to verify report" }
        }

        // Revalidate paths to update the UI.
        revalidatePath("/admin/verification")
        revalidatePath("/admin/reports")
        return { success: true }
    } catch (error) {
        console.error("Error verifying report:", error)
        return { success: false, error: "Connection error" }
    }
}

/**
 * Rejects a report by sending a PATCH request to the report service.
 * @param reportId - The ID of the report to reject.
 * @param token - The authorization token for the request.
 * @returns An object indicating success or failure.
 */
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
                return { success: false, error: "You are not authorized to reject reports." }
            }
            return { success: false, error: "Failed to reject report" }
        }

        // Revalidate paths to update the UI.
        revalidatePath("/admin/verification")
        revalidatePath("/admin/reports")
        return { success: true }
    } catch (error) {
        console.error("Error rejecting report:", error)
        return { success: false, error: "Connection error" }
    }
}
