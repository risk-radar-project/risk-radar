import { NextRequest, NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/server-config"

/**
 * Demo mode categories matching the actual report categories in the system
 * Each category has Polish keywords for matching
 */
const DEMO_CATEGORIES = [
    { 
        category: "INFRASTRUCTURE", 
        label: "Infrastruktura drogowa",
        keywords: ["droga", "chodnik", "dziura", "studzienka", "latarnia", "znak", "barierka", "nawierzchnia", "jezdnia", "krawężnik"]
    },
    { 
        category: "VANDALISM", 
        label: "Wandalizm",
        keywords: ["wandalizm", "graffiti", "zniszczenie", "dewastacja", "uszkodzenie", "rozbite", "połamane"]
    },
    { 
        category: "LIGHTING", 
        label: "Oświetlenie",
        keywords: ["oświetlenie", "lampa", "światło", "ciemno", "żarówka", "latarnia"]
    },
    { 
        category: "GREENERY", 
        label: "Zieleń miejska",
        keywords: ["drzewo", "krzew", "trawnik", "zieleń", "park", "roślina", "gałąź"]
    },
    { 
        category: "WASTE_ILLEGAL_DUMPING", 
        label: "Śmieci / nielegalne zaśmiecanie",
        keywords: ["śmieci", "odpady", "wysypisko", "zaśmiecanie", "kosz", "worki", "butelki"]
    },
    { 
        category: "PARTICIPANT_BEHAVIOR", 
        label: "Zachowania kierowców/pieszych",
        keywords: ["kierowca", "pieszy", "agresja", "niebezpieczna", "jazda", "przepisy", "mandat"]
    },
    { 
        category: "PARTICIPANT_HAZARD", 
        label: "Zagrożenia dla uczestników ruchu",
        keywords: ["wypadek", "niebezpieczne", "zagrożenie", "kolizja", "potrącenie", "rowerzysta"]
    },
    { 
        category: "BIOLOGICAL_HAZARD", 
        label: "Zagrożenia biologiczne",
        keywords: ["szczur", "owad", "kleszcz", "barszcz", "roślina", "inwazyjne", "alergen"]
    },
    { 
        category: "OTHER", 
        label: "Inne",
        keywords: []
    }
]

function detectCategory(title: string, description: string): { category: string; label: string; confidence: number; probabilities: Record<string, number> } {
    const text = `${title} ${description}`.toLowerCase()
    
    // Check each category for keyword matches
    const scores: Record<string, number> = {}
    let maxScore = 0
    let bestCategory = DEMO_CATEGORIES[DEMO_CATEGORIES.length - 1] // Default to OTHER
    
    for (const cat of DEMO_CATEGORIES) {
        const matchCount = cat.keywords.filter(kw => text.includes(kw)).length
        scores[cat.category] = matchCount > 0 ? 0.3 + (matchCount * 0.15) : 0.05
        if (scores[cat.category] > maxScore) {
            maxScore = scores[cat.category]
            bestCategory = cat
        }
    }
    
    // Normalize probabilities
    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    const probabilities: Record<string, number> = {}
    for (const key of Object.keys(scores)) {
        probabilities[key] = Math.round((scores[key] / total) * 100) / 100
    }
    
    return {
        category: bestCategory.category,
        label: bestCategory.label,
        confidence: Math.min(0.85, maxScore),
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

        const { category, label, confidence, probabilities } = detectCategory(title || "", description || "")

        return NextResponse.json({
            report_id: report_id || `demo-${Date.now()}`,
            category,
            category_label: label,
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
