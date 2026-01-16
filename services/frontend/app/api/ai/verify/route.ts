import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthAndUserId, errorResponse } from "@/lib/api/server-config"

/**
 * POST /api/ai/verify
 * Proxy to AI Verification-Duplication Service
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization")
        if (!authHeader) {
            return errorResponse("Unauthorized", 401)
        }

        const body = await request.json()

        console.log("AI Verify API: Forwarding request to verification service")

        // Add timeout for better UX
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout (BERT can be slower)

        try {
            const response = await fetch(
                `${GATEWAY_URL}/api/ai/verification/verify`,
                withAuthAndUserId(authHeader, {
                    method: "POST",
                    body: JSON.stringify(body),
                    signal: controller.signal
                })
            )

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
