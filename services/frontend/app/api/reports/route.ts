import { NextResponse } from "next/server"

const GATEWAY_URL = process.env.GATEWAY_URL || "http://api-gateway:8080"

export async function GET() {
    try {
        console.log(`API Route: Fetching reports from ${GATEWAY_URL}...`)
        const response = await fetch(`${GATEWAY_URL}/api/map/reports`, {
            cache: "no-store",
            headers: {
                "Content-Type": "application/json"
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Backend returned error: ${response.status}`, errorText)
            return NextResponse.json({ error: `Backend error: ${response.status}` }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: unknown) {
        console.error("Failed to fetch from backend:", error)
        return NextResponse.json(
            {
                error: "Failed to fetch data",
                details: error instanceof Error ? error.message : undefined,
                cause: error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined
            },
            { status: 500 }
        )
    }
}
