import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler } from "@/lib/api/server-config"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    return withAuthHandler(request, async (token) => {
        // Gateway strips /api/reports, so report-service receives /reports/pending
        const res = await fetch(`${GATEWAY_URL}/api/reports/pending`, {
            cache: "no-store",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error(`[API] Failed to fetch pending reports: ${res.status}`, errorText)
            return NextResponse.json({ error: "Failed to fetch pending reports" }, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    })
}
