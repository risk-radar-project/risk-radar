import { NextRequest, NextResponse } from "next/server"

const AI_VERIFICATION_SERVICE_URL =
    process.env.AI_VERIFICATION_SERVICE_URL || "http://ai-verification-duplication-service:8080"

/**
 * POST /api/ai/verify
 * Proxy to AI Verification-Duplication Service
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        console.log("AI Verify API: Forwarding request to verification service")

        // Add timeout for better UX
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout (BERT can be slower)

        try {
            const response = await fetch(`${AI_VERIFICATION_SERVICE_URL}/verify`, {
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
                console.error(`AI Verification service error: ${response.status}`, errorText)
                return NextResponse.json(
                    { error: `Verification service error: ${response.status}` },
                    { status: response.status }
                )
            }

            const data = await response.json()
            return NextResponse.json(data)
        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)

            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                console.error("AI Verification service timeout")
                return NextResponse.json({ error: "Verification service timeout" }, { status: 504 })
            }
            throw fetchError
        }
    } catch (error: unknown) {
        console.error("Failed to verify report:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json(
            {
                error: "Failed to verify report",
                details: errorMessage
            },
            { status: 500 }
        )
    }
}
