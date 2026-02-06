/**
 * AI Services API Client
 * Handles communication with AI Categorization and Verification services
 */

// Types for AI Categorization Service
export interface CategorizationRequest {
    report_id: string
    title: string
    description: string
    user_id: string
    metadata?: Record<string, unknown>
}

export interface CategorizationResponse {
    report_id: string
    category: string
    category_label?: string  // Polish label for display (from demo mode)
    confidence: number
    all_probabilities?: Record<string, number>
    processing_time_ms: number
    demo_mode?: boolean
    demo_notice?: string
}

// Types for AI Verification Service
export interface VerificationRequest {
    report_id: string
    title: string
    description: string
    user_id: string
    metadata?: Record<string, unknown>
}

export interface VerificationResponse {
    report_id: string
    is_fake: boolean
    fake_probability: number
    confidence: "low" | "medium" | "high"
    explanation?: string
}

// Combined response for frontend
export interface AIAnalysisResult {
    categorization?: CategorizationResponse
    verification?: VerificationResponse
    error?: string
}

export interface SubmissionResult {
    accepted: boolean
    requiresReview: boolean
    message: string
    verification: VerificationResponse | null
    reportId: string
}

import { getFreshAccessToken } from "@/lib/auth/auth-service"

// API base URLs (will be proxied through Next.js API routes)
const AI_CATEGORIZATION_URL = "/api/ai/categorize"
const AI_VERIFICATION_URL = "/api/ai/verify"

/**
 * Call AI Categorization Service to get suggested category
 * Used during report creation (onBlur/debounce)
 */
export async function categorizeReport(
    title: string,
    description: string,
    userId: string = "anonymous"
): Promise<CategorizationResponse> {
    const tempReportId = `temp-${Date.now()}`
    const token = await getFreshAccessToken()

    // Combine title and description for better context, or just use title
    // The backend expects a list of "titles" (text strings)
    const textToCategorize = description ? `${title} . ${description}` : title

    const response = await fetch(AI_CATEGORIZATION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        // Adapt to backend contract: { titles: [str] }
        body: JSON.stringify({
            titles: [textToCategorize]
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Categorization failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    // Adapt backend response to frontend contract
    // Backend returns: { results: [ { text, predicted_category, confidence, ... } ] }
    if (data.results && data.results.length > 0) {
        const result = data.results[0]
        return {
            report_id: tempReportId,
            category: result.predicted_category,
            confidence: result.confidence,
            processing_time_ms: 0 // Not provided by backend
        }
    }

    throw new Error("No categorization results returned")
}

/**
 * Call AI Verification Service to check if report is valid
 * Used when submitting the report
 */
export async function verifyReportContent(
    reportId: string,
    title: string,
    description: string,
    userId: string
): Promise<VerificationResponse> {
    const token = await getFreshAccessToken()

    const response = await fetch(AI_VERIFICATION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
            report_id: reportId,
            title,
            description,
            user_id: userId,
            metadata: { source: "frontend-submission" }
        } satisfies VerificationRequest)
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Verification failed: ${response.status} - ${errorText}`)
    }

    return response.json()
}

/**
 * Determine submission result based on verification response
 */
export function determineSubmissionResult(reportId: string, verification: VerificationResponse): SubmissionResult {
    // Thresholds for automatic acceptance
    // const FAKE_THRESHOLD = 0.5  // Above this = likely fake
    // const HIGH_CONFIDENCE_THRESHOLD = 0.3  // Confidence difference from 0.5

    const isFake = verification.is_fake
    const isHighConfidenceFake = isFake && verification.confidence === "high"
    const isLowConfidenceResult = verification.confidence === "low"

    if (isHighConfidenceFake) {
        // High confidence fake - reject or flag for review
        return {
            accepted: false,
            requiresReview: true,
            message: "Zgłoszenie wymaga weryfikacji. Wykryto potencjalnie nieprawdziwe treści.",
            verification,
            reportId
        }
    }

    if (isFake && !isLowConfidenceResult) {
        // Medium confidence fake - needs human review
        return {
            accepted: true,
            requiresReview: true,
            message: "Zgłoszenie przekazane do dalszej weryfikacji.",
            verification,
            reportId
        }
    }

    // Not fake or low confidence - auto accept
    return {
        accepted: true,
        requiresReview: false,
        message: "Zgłoszenie zaakceptowane!",
        verification,
        reportId
    }
}

/**
 * Full submission flow: verify then determine result
 */
export async function submitAndVerifyReport(
    reportId: string,
    title: string,
    description: string,
    userId: string
): Promise<SubmissionResult> {
    try {
        const verification = await verifyReportContent(reportId, title, description, userId)
        return determineSubmissionResult(reportId, verification)
    } catch (error) {
        // On verification error, accept with review flag (fail-open for UX)
        console.error("Verification error:", error)
        return {
            accepted: true,
            requiresReview: true,
            message: "Zgłoszenie przyjęte. Weryfikacja automatyczna niedostępna.",
            verification: null,
            reportId
        }
    }
}
