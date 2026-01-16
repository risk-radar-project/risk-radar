import { NextRequest, NextResponse } from "next/server"
import { REPORT_SERVICE_URL, errorResponse } from "@/lib/api/server-config"

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const queryString = searchParams.toString()
        const authHeader = request.headers.get("Authorization")

        const url = `${REPORT_SERVICE_URL}/reports${queryString ? `?${queryString}` : ""}`

        const response = await fetch(url, {
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                ...(authHeader ? { Authorization: authHeader } : {})
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[admin/reports] Backend returned error: ${response.status}`, errorText)
            return errorResponse(`Backend error: ${response.status}`, response.status)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: unknown) {
        console.error("[admin/reports] Failed to fetch from backend:", error)
        return errorResponse("Failed to fetch data", 500)
    }
}
