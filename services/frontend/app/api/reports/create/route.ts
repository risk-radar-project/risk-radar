import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler } from "@/lib/api/server-config"

export async function POST(request: NextRequest) {
    return withAuthHandler(request, async (token) => {
        const body = await request.json()

        console.log("API Route: Creating report with data:", body)

        // Gateway strips /api/reports, so report-service receives /createReport
        const response = await fetch(`${GATEWAY_URL}/api/reports/createReport`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": request.headers.get("user-agent") || "RiskRadar-Frontend",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Report service returned error: ${response.status}`, errorText)
            return NextResponse.json({ error: `Failed to create report: ${response.status}` }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data, { status: 201 })
    })
}
