import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler } from "@/lib/api/server-config"

export async function GET(request: NextRequest) {
    return withAuthHandler(request, async (token) => {
        const { searchParams } = new URL(request.url)
        const queryString = searchParams.toString()

        const url = `${GATEWAY_URL}/api/notifications/notifications${queryString ? `?${queryString}` : ""}`

        const res = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    })
}
