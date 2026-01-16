import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL } from "@/lib/api/server-config"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const res = await fetch(`${GATEWAY_URL}/api/validate-reset-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    } catch (error) {
        console.error("Validate reset token error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
