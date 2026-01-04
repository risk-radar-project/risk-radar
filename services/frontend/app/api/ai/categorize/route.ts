import { NextRequest, NextResponse } from "next/server"

const AI_CATEGORIZATION_SERVICE_URL = process.env.AI_CATEGORIZATION_SERVICE_URL || "http://ai-categorization-service:8080"

/**
 * POST /api/ai/categorize
 * Proxy to AI Categorization Service
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        console.log("AI Categorize API: Forwarding request to categorization service")

        // Add timeout for better UX
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        try {
            const response = await fetch(`${AI_CATEGORIZATION_SERVICE_URL}/categorize`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`AI Categorization service error: ${response.status}`, errorText)
                return NextResponse.json(
                    { error: `Categorization service error: ${response.status}` },
                    { status: response.status }
                )
            }

            const data = await response.json()
            return NextResponse.json(data)
        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)

            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                console.error("AI Categorization service timeout")
                return NextResponse.json({ error: "Categorization service timeout" }, { status: 504 })
            }
            throw fetchError
        }
    } catch (error: unknown) {
        console.error("Failed to categorize report:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json(
            {
                error: "Failed to categorize report",
                details: errorMessage
            },
            { status: 500 }
        )
    }
}
