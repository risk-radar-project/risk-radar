import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler, errorResponse } from "@/lib/api/server-config"

export async function GET(request: NextRequest) {
    return withAuthHandler(request, async (token) => {
        const searchParams = request.nextUrl.searchParams
        const queryString = searchParams.toString()

        // Gateway strips /api/reports prefix, so /api/reports becomes /
        const url = `${GATEWAY_URL}/api/reports${queryString ? `?${queryString}` : ""}`

        const response = await fetch(url, {
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[admin/reports] Backend returned error: ${response.status}`, errorText)
            return errorResponse(`Backend error: ${response.status}`, response.status)
        }

        const data = await response.json()
        return NextResponse.json(data)
    })
}
