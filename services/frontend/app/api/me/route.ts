import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler } from "@/lib/api/server-config"

export async function GET(request: NextRequest) {
    return withAuthHandler(request, async (token) => {
        const res = await fetch(`${GATEWAY_URL}/api/me`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    })
}
