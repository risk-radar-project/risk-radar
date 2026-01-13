import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || "http://127.0.0.1:8085"

    try {
        const authHeader = request.headers.get("Authorization")

        const res = await fetch(`${REPORT_SERVICE_URL}/reports/pending`, {
            cache: "no-store",
            headers: {
                ...(authHeader ? { Authorization: authHeader } : {})
            }
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error(`[API] Failed to fetch pending reports: ${res.status}`, errorText)
            return NextResponse.json({ error: "Failed to fetch pending reports" }, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[API] Error fetching pending reports:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
