import { NextResponse } from "next/server"
import { parseJwt } from "@/lib/auth/jwt-utils"
import { GATEWAY_URL, errorResponse } from "@/lib/api/server-config"

export async function GET(request: Request) {
    try {
        // 1. Check Authorization
        const authHeader = request.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return errorResponse("Missing or invalid authorization token", 401)
        }

        const token = authHeader.substring(7)
        const payload = parseJwt(token)

        if (!payload) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 })
        }

        const permissions = payload.permissions || []

        // Allow if has stats:view permission or super admin
        const isAdmin =
            permissions.includes("*:*") ||
            permissions.includes("PERM_*:*") ||
            permissions.includes("stats:view") ||
            permissions.includes("PERM_STATS:VIEW")

        if (!isAdmin) {
            return NextResponse.json(
                { error: "Insufficient permissions. Admin role or stats:view required." },
                { status: 403 }
            )
        }

        // 2. Fetch Report Stats
        let reportStats = {
            totalReports: 0,
            pendingReports: 0,
            verifiedReports: 0,
            rejectedReports: 0,
            reportsToday: 0,
            reportsThisWeek: 0
        }

        try {
            // Gateway strips /api/reports, so report-service receives /reports/stats
            const reportRes = await fetch(`${GATEWAY_URL}/api/reports/stats`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-User-ID": payload.userId || ""
                }
            })
            if (reportRes.ok) {
                reportStats = await reportRes.json()
            } else {
                console.error("Failed to fetch report stats:", reportRes.status, await reportRes.text())
            }
        } catch (error) {
            console.error("Error fetching report stats:", error)
        }

        // 3. Fetch User Stats
        let userStats = {
            totalUsers: 0,
            bannedUsers: 0
        }

        try {
            const userRes = await fetch(`${GATEWAY_URL}/api/users/stats`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-User-ID": payload.userId || ""
                }
            })
            if (userRes.ok) {
                userStats = await userRes.json()
            } else {
                console.error("Failed to fetch user stats:", userRes.status, await userRes.text())
            }
        } catch (error) {
            console.error("Error fetching user stats:", error)
        }

        // 4. Combine and return
        return NextResponse.json({
            ...reportStats,
            ...userStats
        })
    } catch (error) {
        console.error("Error in stats proxy:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
