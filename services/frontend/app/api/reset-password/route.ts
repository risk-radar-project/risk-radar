import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, IS_DEMO_MODE } from "@/lib/api/server-config"

export async function POST(request: NextRequest) {
    if (IS_DEMO_MODE) {
        return NextResponse.json(
            { error: "Resetowanie hasła jest niedostępne w trybie demonstracyjnym", demo_mode: true },
            { status: 403 }
        )
    }

    try {
        const body = await request.json()

        const res = await fetch(`${GATEWAY_URL}/api/reset-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    } catch (error) {
        console.error("Reset password error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
