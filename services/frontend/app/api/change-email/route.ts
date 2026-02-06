import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler, demoModeGuard } from "@/lib/api/server-config"

export async function POST(request: NextRequest) {
    // Block in demo mode (with admin bypass check)
    const authHeader = request.headers.get("Authorization")
    const demoBlock = demoModeGuard(authHeader)
    if (demoBlock) return demoBlock

    return withAuthHandler(request, async (token) => {
        const body = await request.json()

        const res = await fetch(`${GATEWAY_URL}/api/change-email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    })
}
