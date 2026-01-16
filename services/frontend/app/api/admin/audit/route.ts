import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthAndUserId, errorResponse } from "@/lib/api/server-config"

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    // Forward all query parameters
    const { searchParams } = new URL(request.url)
    const upstreamUrl = new URL(`${GATEWAY_URL}/api/audit/logs`)

    searchParams.forEach((value, key) => {
        upstreamUrl.searchParams.set(key, value)
    })

    try {
        const res = await fetch(upstreamUrl.toString(), withAuthAndUserId(authHeader))

        if (!res.ok) {
            const errorText = await res.text().catch(() => "Unknown error")
            console.error(`[admin/audit] Upstream error ${res.status}:`, errorText)
            return errorResponse(`Failed to fetch audit logs: ${res.status}`, res.status)
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[admin/audit] Error fetching audit logs:", error)
        return errorResponse("Internal Server Error", 500)
    }
}
