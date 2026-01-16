import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthAndUserId, errorResponse } from "@/lib/api/server-config"

/**
 * POST /api/ai-assistant/nearby-threats
 *
 * Proxy to AI Assistant Service for analyzing nearby threats
 *
 * Request body:
 * {
 *   latitude: number,
 *   longitude: number,
 *   radius_km?: number (default: 1.0)
 * }
 *
 * Response:
 * {
 *   status: string,
 *   location: { lat: number, lon: number },
 *   radius_km: number,
 *   reports_count: number,
 *   danger_score: number,
 *   danger_level: string,
 *   ai_summary: string,
 *   timestamp: string
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization")
        if (!authHeader) {
            return errorResponse("Unauthorized", 401)
        }

        const body = await request.json()

        console.log("AI Assistant API: Analyzing nearby threats", {
            latitude: body.latitude,
            longitude: body.longitude,
            radius_km: body.radius_km || 1.0
        })

        // Validate required fields
        if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
            return NextResponse.json({ error: "Latitude and longitude are required" }, { status: 400 })
        }

        // Add timeout for better UX
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout for AI

        try {
            const response = await fetch(
                `${GATEWAY_URL}/api/ai/assistant/api/v1/nearby-threats`,
                withAuthAndUserId(authHeader, {
                    method: "POST",
                    body: JSON.stringify({
                        latitude: body.latitude,
                        longitude: body.longitude,
                        radius_km: body.radius_km || 1.0,
                        user_id: body.user_id || null
                    }),
                    signal: controller.signal
                })
            )

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`AI Assistant service error: ${response.status}`, errorText)
                return NextResponse.json(
                    { error: `AI Assistant service error: ${response.status}` },
                    { status: response.status }
                )
            }

            const data = await response.json()
            console.log("AI Assistant API: Analysis complete", {
                danger_level: data.danger_level,
                reports_count: data.reports_count
            })

            return NextResponse.json(data)
        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)

            const error = fetchError as Error

            if (error.name === "AbortError") {
                console.error("AI Assistant service timeout")
                return NextResponse.json({ error: "AI analysis timeout - please try again" }, { status: 504 })
            }

            console.error("AI Assistant service connection error:", error.message)
            return NextResponse.json(
                {
                    error: "Cannot connect to AI Assistant service",
                    details: error.message
                },
                { status: 503 }
            )
        }
    } catch (error: unknown) {
        const e = error as Error
        console.error("AI Assistant API error:", e.message)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
