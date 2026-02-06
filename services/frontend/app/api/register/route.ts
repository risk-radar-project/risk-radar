import { NextResponse } from "next/server"
import { GATEWAY_URL, IS_DEMO_MODE } from "@/lib/api/server-config"

export async function POST(request: Request) {
    // Block registration in demo mode
    if (IS_DEMO_MODE) {
        return NextResponse.json(
            {
                error: "Rejestracja jest niedostępna w trybie demonstracyjnym",
                demo_mode: true,
                message: "W wersji demo nie można tworzyć nowych kont."
            },
            { status: 403 }
        )
    }

    try {
        const body = await request.json()

        const res = await fetch(`${GATEWAY_URL}/api/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    } catch (error) {
        console.error("[api/register] Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
