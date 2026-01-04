"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { categorizeReport, submitAndVerifyReport, type CategorizationResponse, type SubmissionResult } from "@/lib/api/ai"

// Dynamically import map component (client-side only)
const LocationPickerMap = dynamic(() => import("@/components/location-picker-map"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[400px] w-full items-center justify-center rounded-lg bg-[#362c20]">
            <div className="text-lg text-[#e0dcd7]">Ładowanie mapy...</div>
        </div>
    )
})

type ReportCategory =
    | "VANDALISM"
    | "INFRASTRUCTURE"
    | "DANGEROUS_SITUATION"
    | "TRAFFIC_ACCIDENT"
    | "PARTICIPANT_BEHAVIOR"
    | "PARTICIPANT_HAZARD"
    | "WASTE_ILLEGAL_DUMPING"
    | "BIOLOGICAL_HAZARD"
    | "OTHER"

interface CategoryOption {
    value: ReportCategory
    label: string
    icon: string
    aiLabel?: string // Label used by AI model
}

const CATEGORIES: CategoryOption[] = [
    { value: "VANDALISM", label: "Wandalizm", icon: "format_paint", aiLabel: "Wandalizm / graffiti" },
    {
        value: "INFRASTRUCTURE",
        label: "Infrastruktura drogowa/chodników",
        icon: "construction",
        aiLabel: "Infrastruktura drogowa / chodników"
    },
    { value: "DANGEROUS_SITUATION", label: "Niebezpieczne sytuacje", icon: "warning", aiLabel: "Niebezpieczne sytuacje" },
    { value: "TRAFFIC_ACCIDENT", label: "Wypadki drogowe", icon: "car_crash", aiLabel: "Wypadki drogowe" },
    {
        value: "PARTICIPANT_BEHAVIOR",
        label: "Zachowania kierowców/pieszych",
        icon: "person_alert",
        aiLabel: "Zachowania kierowców/pieszych"
    },
    {
        value: "PARTICIPANT_HAZARD",
        label: "Zagrożenia dla pieszych i rowerzystów i kierowców",
        icon: "brightness_alert",
        aiLabel: "Zagrożenia dla pieszych/rowerzystów/kierowców"
    },
    {
        value: "WASTE_ILLEGAL_DUMPING",
        label: "Śmieci/nielegalne zaśmiecanie/nielegalne wysypiska śmieci",
        icon: "delete_sweep",
        aiLabel: "Śmieci / nielegalne zaśmiecanie / wysypiska"
    },
    { value: "BIOLOGICAL_HAZARD", label: "Zagrożenia biologiczne", icon: "bug_report", aiLabel: "Zagrożenia biologiczne" },
    { value: "OTHER", label: "Inne", icon: "help_outline", aiLabel: "Inne" }
]

// Map AI category names to our category values
function mapAICategoryToValue(aiCategory: string): ReportCategory {
    const normalizedAI = aiCategory.toLowerCase().trim()

    for (const cat of CATEGORIES) {
        if (
            cat.aiLabel?.toLowerCase().includes(normalizedAI.split("/")[0].trim()) ||
            normalizedAI.includes(cat.label.toLowerCase().split("/")[0].trim())
        ) {
            return cat.value
        }
    }

    // Specific mappings for common AI outputs
    if (normalizedAI.includes("infrastruktura") || normalizedAI.includes("drog") || normalizedAI.includes("chodnik")) {
        return "INFRASTRUCTURE"
    }
    if (normalizedAI.includes("wandalizm") || normalizedAI.includes("graffiti")) {
        return "VANDALISM"
    }
    if (normalizedAI.includes("śmieci") || normalizedAI.includes("zaśmiecanie") || normalizedAI.includes("wysypisk")) {
        return "WASTE_ILLEGAL_DUMPING"
    }
    if (normalizedAI.includes("zieleń") || normalizedAI.includes("drzew")) {
        return "OTHER" // Could add a specific category
    }

    return "OTHER"
}

export default function SubmitReportPage() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // AI Integration States
    const [isCategorizing, setIsCategorizing] = useState(false)
    const [aiSuggestedCategory, setAiSuggestedCategory] = useState<CategorizationResponse | null>(null)
    const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null)
    const categorizationDebounceRef = useRef<NodeJS.Timeout | null>(null)

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        latitude: null as number | null,
        longitude: null as number | null,
        category: "OTHER" as ReportCategory,
        images: [] as File[]
    })

    // Debounced AI Categorization - triggered on title/description change
    const triggerCategorization = useCallback(async (title: string, description: string) => {
        // Need at least title with 5+ chars to categorize
        if (title.length < 5) {
            setAiSuggestedCategory(null)
            return
        }

        setIsCategorizing(true)
        try {
            const result = await categorizeReport(title, description)
            setAiSuggestedCategory(result)

            // Auto-select AI suggested category if confidence is high enough
            if (result.confidence >= 0.7) {
                const mappedCategory = mapAICategoryToValue(result.category)
                setFormData((prev) => ({ ...prev, category: mappedCategory }))
            }
        } catch (err) {
            console.error("Categorization error:", err)
            // Don't show error to user - categorization is optional enhancement
        } finally {
            setIsCategorizing(false)
        }
    }, [])

    // Handle input changes with debounced categorization
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))

        // Trigger categorization on title or description change (debounced)
        if (name === "title" || name === "description") {
            if (categorizationDebounceRef.current) {
                clearTimeout(categorizationDebounceRef.current)
            }

            categorizationDebounceRef.current = setTimeout(() => {
                const newTitle = name === "title" ? value : formData.title
                const newDescription = name === "description" ? value : formData.description
                triggerCategorization(newTitle, newDescription)
            }, 800) // 800ms debounce
        }
    }

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (categorizationDebounceRef.current) {
                clearTimeout(categorizationDebounceRef.current)
            }
        }
    }, [])

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFormData((prev) => ({ ...prev, images: Array.from(e.target.files || []) }))
        }
    }

    const handleLocationSelect = (lat: number, lng: number) => {
        setFormData((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lng
        }))
    }

    // Accept AI suggested category
    const acceptAISuggestion = () => {
        if (aiSuggestedCategory) {
            const mappedCategory = mapAICategoryToValue(aiSuggestedCategory.category)
            setFormData((prev) => ({ ...prev, category: mappedCategory }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)
        setSubmissionResult(null)

        // Validate location
        if (formData.latitude === null || formData.longitude === null) {
            setError("Proszę wybrać lokalizację na mapie")
            setIsSubmitting(false)
            return
        }

        const accessToken = localStorage.getItem("access_token")

        try {
            // First, upload images if any
            const imageIds: string[] = []
            if (formData.images.length > 0) {
                for (const image of formData.images) {
                    const imageFormData = new FormData()
                    imageFormData.append("file", image)

                    const imageResponse = await fetch("/api/media/upload", {
                        method: "POST",
                        body: imageFormData,
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        }
                    })

                    if (!imageResponse.ok) {
                        throw new Error("Nie udało się przesłać zdjęć")
                    }

                    const imageData = await imageResponse.json()
                    if (imageData.id) {
                        imageIds.push(imageData.id)
                    }
                }
            }

            // Get userId from JWT token
            let userId = "ea2698bc-9348-44f5-b64b-0b973da92da7" // Fallback
            if (accessToken) {
                try {
                    const { parseJwt } = await import("@/lib/auth/jwt-utils")
                    const decoded = parseJwt(accessToken)
                    if (decoded?.userId) {
                        userId = decoded.userId
                    }
                } catch {
                    console.warn("Failed to parse JWT, using fallback userId")
                }
            }

            // Then submit the report
            const reportData = {
                title: formData.title,
                description: formData.description,
                latitude: formData.latitude,
                longitude: formData.longitude,
                reportCategory: formData.category,
                imageIds: imageIds.length > 0 ? imageIds : undefined,
                userId: userId
            }

            const response = await fetch("/api/reports/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify(reportData)
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Nie udało się utworzyć zgłoszenia")
            }

            const createdReport = await response.json()
            const reportId = createdReport.id || `report-${Date.now()}`

            // Step 2: AI Verification - check if report is valid/fake
            const verificationResult = await submitAndVerifyReport(
                reportId,
                formData.title,
                formData.description,
                "ea2698bc-9348-44f5-b64b-0b973da92da7"
            )

            setSubmissionResult(verificationResult)

            // Show appropriate success message based on verification
            if (verificationResult.accepted && !verificationResult.requiresReview) {
                // Fully accepted - redirect after showing success
                setSuccess(true)
                setTimeout(() => {
                    window.location.href = "/"
                }, 2500)
            } else if (verificationResult.requiresReview) {
                // Needs review - show message but still "success"
                setSuccess(true)
                setTimeout(() => {
                    window.location.href = "/"
                }, 3500)
            } else {
                // Rejected - show error
                setError(verificationResult.message)
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Wystąpił błąd podczas tworzenia zgłoszenia"
            setError(errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (success && submissionResult) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#2a221a] p-4">
                <div className="w-full max-w-md rounded-xl bg-[#362c20] p-8 text-center">
                    <div className="mb-4">
                        {submissionResult.requiresReview ? (
                            <span className="material-symbols-outlined text-6xl text-yellow-500">pending</span>
                        ) : (
                            <span className="material-symbols-outlined text-6xl text-green-500">check_circle</span>
                        )}
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-[#e0dcd7]">
                        {submissionResult.requiresReview ? "Zgłoszenie przyjęte!" : "Zgłoszenie zaakceptowane!"}
                    </h2>
                    <p className="mb-4 text-[#e0dcd7]/70">{submissionResult.message}</p>
                    {submissionResult.verification && (
                        <div className="mb-4 rounded-lg bg-[#2a221a] p-3 text-left">
                            <p className="mb-1 text-xs text-[#e0dcd7]/50">Wynik weryfikacji AI:</p>
                            <p className="text-sm text-[#e0dcd7]">
                                Pewność:{" "}
                                <span
                                    className={`font-semibold ${
                                        submissionResult.verification.confidence === "high"
                                            ? "text-green-400"
                                            : submissionResult.verification.confidence === "medium"
                                              ? "text-yellow-400"
                                              : "text-gray-400"
                                    }`}
                                >
                                    {submissionResult.verification.confidence}
                                </span>
                            </p>
                        </div>
                    )}
                    <p className="text-sm text-[#e0dcd7]/50">Przekierowywanie do mapy...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#2a221a] px-4 py-8">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="mb-4 inline-flex items-center gap-2 text-[#e0dcd7] transition-colors hover:text-[#d97706]"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span>Powrót do mapy</span>
                    </Link>
                    <h1 className="mb-2 text-4xl font-bold text-[#e0dcd7]">Zgłoś Nowe Zdarzenie</h1>
                    <p className="text-[#e0dcd7]/70">Wypełnij formularz, aby zgłosić nowe zdarzenie w Twojej okolicy</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6 rounded-xl bg-[#362c20] p-6">
                    {error && <div className="rounded-lg border border-red-500 bg-red-500/20 p-4 text-red-200">{error}</div>}

                    {/* Title */}
                    <div>
                        <label htmlFor="title" className="mb-2 block font-semibold text-[#e0dcd7]">
                            Tytuł zgłoszenia *
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            required
                            value={formData.title}
                            onChange={handleInputChange}
                            className="w-full rounded-lg border border-[#e0dcd7]/20 bg-[#2a221a] px-4 py-3 text-[#e0dcd7] transition-colors focus:border-[#d97706] focus:outline-none"
                            placeholder="np. Uszkodzony chodnik"
                        />
                    </div>

                    {/* Category with AI Suggestion */}
                    <div>
                        <label htmlFor="category" className="mb-2 block font-semibold text-[#e0dcd7]">
                            Kategoria *
                            {isCategorizing && (
                                <span className="ml-2 text-sm font-normal text-[#d97706]">
                                    <span className="animate-pulse">Analizowanie przez AI...</span>
                                </span>
                            )}
                        </label>

                        {/* AI Suggestion Badge */}
                        {aiSuggestedCategory && !isCategorizing && (
                            <div className="mb-3 rounded-lg border border-[#d97706]/30 bg-[#d97706]/10 p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="mb-1 flex items-center gap-2">
                                            <p className="text-xs text-[#d97706]">🤖 Sugerowana kategoria (AI):</p>
                                            {/* AI Sparkle Animation */}
                                            <div className="relative inline-flex">
                                                <span className="animate-pulse text-xs text-yellow-400">✨</span>
                                                <span className="absolute -top-1 -right-1 animate-ping text-[8px] text-yellow-300">
                                                    ✨
                                                </span>
                                            </div>
                                        </div>
                                        <p className="font-medium text-[#e0dcd7]">{aiSuggestedCategory.category}</p>
                                        <p className="mt-1 text-xs text-[#e0dcd7]/60">
                                            Pewność: {(aiSuggestedCategory.confidence * 100).toFixed(0)}%
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={acceptAISuggestion}
                                        className="rounded-md bg-[#d97706] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[#d97706]/80"
                                    >
                                        Użyj
                                    </button>
                                </div>
                            </div>
                        )}

                        <select
                            id="category"
                            name="category"
                            required
                            value={formData.category}
                            onChange={handleInputChange}
                            className="w-full rounded-lg border border-[#e0dcd7]/20 bg-[#2a221a] px-4 py-3 text-[#e0dcd7] transition-colors focus:border-[#d97706] focus:outline-none"
                        >
                            {CATEGORIES.map((cat) => (
                                <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="mb-2 block font-semibold text-[#e0dcd7]">
                            Opis
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows={4}
                            className="w-full resize-none rounded-lg border border-[#e0dcd7]/20 bg-[#2a221a] px-4 py-3 text-[#e0dcd7] transition-colors focus:border-[#d97706] focus:outline-none"
                            placeholder="Opisz dokładnie problem..."
                        />
                    </div>

                    {/* Location Map */}
                    <div>
                        <label className="mb-2 block font-semibold text-[#e0dcd7]">
                            Lokalizacja *{" "}
                            {formData.latitude && formData.longitude && (
                                <span className="ml-2 text-sm font-normal text-[#d97706]">✓ Wybrano</span>
                            )}
                        </label>
                        <p className="mb-3 text-sm text-[#e0dcd7]/60">
                            Kliknij na mapie lub użyj przycisku lokalizacji w prawym dolnym rogu mapy
                        </p>
                        <LocationPickerMap onLocationSelect={handleLocationSelect} />
                    </div>

                    {/* Images */}
                    <div>
                        <label htmlFor="images" className="mb-2 block font-semibold text-[#e0dcd7]">
                            Zdjęcia (opcjonalne)
                        </label>
                        <input
                            type="file"
                            id="images"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="w-full rounded-lg border border-[#e0dcd7]/20 bg-[#2a221a] px-4 py-3 text-[#e0dcd7] transition-colors file:mr-4 file:rounded file:border-0 file:bg-[#d97706] file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-[#d97706]/80 focus:border-[#d97706] focus:outline-none"
                        />
                        {formData.images.length > 0 && (
                            <p className="mt-2 text-sm text-[#e0dcd7]/70">
                                Wybrano {formData.images.length} {formData.images.length === 1 ? "zdjęcie" : "zdjęć"}
                            </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.latitude || !formData.longitude}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d97706] px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-[#d97706]/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined">send</span>
                        {isSubmitting ? "Weryfikowanie i wysyłanie..." : "Wyślij Zgłoszenie"}
                    </button>

                    {isSubmitting && (
                        <p className="text-center text-sm text-[#e0dcd7]/60">
                            Twoje zgłoszenie jest weryfikowane przez AI...
                        </p>
                    )}
                </form>
            </div>
        </div>
    )
}
