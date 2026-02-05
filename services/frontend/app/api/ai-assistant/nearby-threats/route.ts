import { NextRequest, NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/server-config"

/**
 * POST /api/ai-assistant/nearby-threats
 *
 * DEMO MODE: Returns simulated AI analysis response
 * AI Assistant service is disabled in demo mode to save resources
 *
 * Request body:
 * {
 *   latitude: number,
 *   longitude: number,
 *   radius_km?: number (default: 1.0)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization")
        if (!authHeader) {
            return errorResponse("Unauthorized", 401)
        }

        const body = await request.json()

        // Validate required fields
        if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
            return NextResponse.json({ error: "Latitude and longitude are required" }, { status: 400 })
        }

        const lat = body.latitude
        const lng = body.longitude
        const radiusKm = body.radius_km || 1.0

        console.log("AI Assistant API: [DEMO MODE] Returning simulated analysis", {
            latitude: lat,
            longitude: lng,
            radius_km: radiusKm
        })

        // Simulate processing delay (200-400ms like real AI would take)
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200))

        // Demo response - simulated safety analysis
        // Vary danger level based on coordinates to make it feel more realistic
        const coordHash = Math.abs(Math.floor((lat * 1000 + lng * 100)) % 100)
        let dangerLevel: string
        let dangerScore: number

        if (coordHash < 60) {
            dangerLevel = "NISKI"
            dangerScore = 10 + Math.floor(Math.random() * 20)
        } else if (coordHash < 85) {
            dangerLevel = "ŚREDNI"
            dangerScore = 35 + Math.floor(Math.random() * 25)
        } else {
            dangerLevel = "PODWYŻSZONY"
            dangerScore = 60 + Math.floor(Math.random() * 20)
        }

        // Simulated reports count
        const reportsCount = Math.floor(coordHash / 15)

        return NextResponse.json({
            status: "success",
            location: { lat, lon: lng },
            radius_km: radiusKm,
            reports_count: reportsCount,
            danger_score: dangerScore,
            danger_level: dangerLevel,
            ai_summary: `[Tryb demo] Analiza bezpieczeństwa dla wybranego obszaru. W promieniu ${radiusKm}km znaleziono ${reportsCount} zgłoszeń. Poziom zagrożenia: ${dangerLevel}. W pełnej wersji AI analizuje rzeczywiste dane i generuje szczegółowe rekomendacje.`,
            timestamp: new Date().toISOString(),
            demo_mode: true,
            demo_notice: "Asystent AI jest niedostępny w trybie demo. Wyświetlane dane są symulowane."
        })
    } catch (error: unknown) {
        const e = error as Error
        console.error("AI Assistant API error:", e.message)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
