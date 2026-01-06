import { NextRequest, NextResponse } from "next/server"

const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || "http://127.0.0.1:8085"

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const queryString = searchParams.toString()
        const authHeader = request.headers.get("Authorization")

        const url = `${REPORT_SERVICE_URL}/reports${queryString ? `?${queryString}` : ""}`
        console.log(`Admin API Route: Fetching reports from ${url}`)

        const response = await fetch(url, {
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                ...(authHeader ? { Authorization: authHeader } : {})
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json(
            {
                error: "Failed to fetch data",
                details: errorMessage
            },
            { status: 500 }
        )
    }
}
