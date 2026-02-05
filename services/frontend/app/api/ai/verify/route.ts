import { NextRequest, NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/server-config"

/**
 * POST /api/ai/verify
 * DEMO MODE: Returns simulated AI verification response
 * AI Verification service is disabled in demo mode to save resources
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization")
        if (!authHeader) {
            return errorResponse("Unauthorized", 401)
        }

        const body = await request.json()
        const { report_id, title, description } = body

        console.log("AI Verify API: [DEMO MODE] Returning simulated verification")

        // Simulate processing delay (100-300ms like real BERT would take)
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))

        // In demo mode, we always return "not fake" with high confidence
        // This allows all reports to be submitted smoothly
        const textLength = ((title || "") + (description || "")).length
        const hasReasonableContent = textLength > 20

        return NextResponse.json({
            report_id: report_id || `demo-${Date.now()}`,
            is_fake: false,
            fake_probability: hasReasonableContent ? 0.05 + Math.random() * 0.1 : 0.15 + Math.random() * 0.1,
            confidence: hasReasonableContent ? "high" : "medium",
            explanation: "Tryb demo - weryfikacja AI jest wyłączona. Wszystkie zgłoszenia są akceptowane do manualnej weryfikacji.",
            processing_time_ms: Math.round(100 + Math.random() * 200),
            demo_mode: true,
            demo_notice: "Weryfikacja BERT/AI jest niedostępna w trybie demo. Zgłoszenia są akceptowane automatycznie."
        })
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
