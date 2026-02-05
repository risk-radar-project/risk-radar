import { NextRequest, NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/server-config"

/**
 * Demo mode categories with realistic probabilities
 */
const DEMO_CATEGORIES = [
    { category: "INFRASTRUCTURE", keywords: ["droga", "most", "budynek", "chodnik", "latarnia", "dziura", "studzienka"] },
    { category: "ENVIRONMENT", keywords: ["drzewo", "śmieci", "zanieczyszczenie", "odpady", "hałas", "powietrze"] },
    { category: "SAFETY", keywords: ["wypadek", "niebezpieczeństwo", "pożar", "kradzież", "wandalizm", "zagrożenie"] },
    { category: "TRANSPORT", keywords: ["autobus", "tramwaj", "korek", "sygnalizacja", "parking", "rower"] },
    { category: "OTHER", keywords: [] }
]

function detectCategory(title: string, description: string): { category: string; confidence: number; probabilities: Record<string, number> } {
    const text = `${title} ${description}`.toLowerCase()
    
    // Check each category for keyword matches
    const scores: Record<string, number> = {}
    let maxScore = 0
    let bestCategory = "OTHER"
    
    for (const cat of DEMO_CATEGORIES) {
        const matchCount = cat.keywords.filter(kw => text.includes(kw)).length
        scores[cat.category] = matchCount > 0 ? 0.3 + (matchCount * 0.15) : 0.05
        if (scores[cat.category] > maxScore) {
            maxScore = scores[cat.category]
            bestCategory = cat.category
        }
    }
    
    // Normalize probabilities
    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    const probabilities: Record<string, number> = {}
    for (const key of Object.keys(scores)) {
        probabilities[key] = Math.round((scores[key] / total) * 100) / 100
    }
    
    return {
        category: bestCategory,
        confidence: Math.min(0.95, maxScore),
        probabilities
    }
}

/**
 * POST /api/ai/categorize
 * DEMO MODE: Returns simulated AI categorization response
 * AI Categorization service is disabled in demo mode to save resources
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization")
        if (!authHeader) {
            return errorResponse("Unauthorized", 401)
        }

        const body = await request.json()
        const { report_id, title, description } = body

        console.log("AI Categorize API: [DEMO MODE] Returning simulated categorization")

        // Simulate processing delay (50-150ms)
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100))

        const { category, confidence, probabilities } = detectCategory(title || "", description || "")

        return NextResponse.json({
            report_id: report_id || `demo-${Date.now()}`,
            category,
            confidence,
            all_probabilities: probabilities,
            processing_time_ms: Math.round(50 + Math.random() * 100),
            demo_mode: true,
            demo_notice: "Tryb demo - kategoryzacja oparta na słowach kluczowych"
        })
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
