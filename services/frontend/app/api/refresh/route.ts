import { NextResponse } from "next/server"
import { GATEWAY_URL } from "@/lib/api/server-config"

export async function POST(request: Request) {
    try {
        const body = await request.json()

        const res = await fetch(`${GATEWAY_URL}/api/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    } catch (error) {
        console.error("[api/refresh] Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
