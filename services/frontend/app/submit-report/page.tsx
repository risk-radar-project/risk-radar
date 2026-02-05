"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { categorizeReport, type CategorizationResponse, type SubmissionResult } from "@/lib/api/ai"
import { validateReport, validateAndSanitize } from "@/lib/validation/report-validation"

import { getFreshAccessToken } from "@/lib/auth/auth-service"

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
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [countdown, setCountdown] = useState(3)

    // Field-level validation errors
    const [fieldErrors, setFieldErrors] = useState<{
        title?: string
        description?: string
    }>({})

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
        category: "OTHER" as ReportCategory
    })

    // Image Upload State
    interface UploadedImage {
        id: string
        previewUrl: string
        file: File
        status: "uploading" | "completed" | "error"
    }
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
    // We'll use a ref to prevent stale state issues during async uploads
    const uploadedImagesRef = useRef<UploadedImage[]>([])

    // Check if any images are currently uploading
    const isUploading = uploadedImages.some((img) => img.status === "uploading")
    const [isDragging, setIsDragging] = useState(false)

    // Update ref when state changes
    useEffect(() => {
        uploadedImagesRef.current = uploadedImages
    }, [uploadedImages])

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

        // Sanitize input before storing
        const sanitizedValue = name === "title" || name === "description" ? validateAndSanitize(value) : value
        setFormData((prev) => ({ ...prev, [name]: sanitizedValue }))

        // Client-side validation
        const newFieldErrors = { ...fieldErrors }

        if (name === "title") {
            const titleLength = sanitizedValue.length
            if (titleLength < 3) {
                newFieldErrors.title = "Tytuł musi mieć co najmniej 3 znaki"
            } else if (titleLength > 255) {
                newFieldErrors.title = "Tytuł nie może przekraczać 255 znaków"
            } else {
                delete newFieldErrors.title
            }
        }

        if (name === "description") {
            const descLength = sanitizedValue.length
            if (descLength > 2000) {
                newFieldErrors.description = "Opis nie może przekraczać 2000 znaków"
            } else if (descLength > 1800) {
                // Soft warning when approaching limit
                newFieldErrors.description = `Opis jest bardzo długi. Pozostało ${2000 - descLength} znaków.`
            } else {
                delete newFieldErrors.description
            }
        }

        setFieldErrors(newFieldErrors)

        // Trigger categorization on title or description change (debounced)
        if (name === "title" || name === "description") {
            if (categorizationDebounceRef.current) {
                clearTimeout(categorizationDebounceRef.current)
            }

            categorizationDebounceRef.current = setTimeout(() => {
                const newTitle = name === "title" ? sanitizedValue : formData.title
                const newDescription = name === "description" ? sanitizedValue : formData.description
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

    const handleFiles = async (files: File[]) => {
        const currentCount = uploadedImages.length
        const maxImages = 5
        const remainingSlots = maxImages - currentCount

        if (remainingSlots <= 0) {
            setError("Maksymalnie można dodać 5 zdjęć.")
            return
        }

        const filesToUpload = files.slice(0, remainingSlots)

        if (files.length > remainingSlots) {
            setError(`Wybrano ${files.length} zdjęć, ale dodano tylko ${remainingSlots} (limit: ${maxImages}).`)
        }

        // Optimistic update - add placeholders
        const newPlaceholders: UploadedImage[] = filesToUpload.map((file) => ({
            id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
            previewUrl: URL.createObjectURL(file), // Local preview while uploading
            file,
            status: "uploading"
        }))

        setUploadedImages((prev) => [...prev, ...newPlaceholders])

        // Ensure we have a valid token (refresh if needed)
        let accessToken = localStorage.getItem("access_token")
        try {
            const freshToken = await getFreshAccessToken()
            if (freshToken) accessToken = freshToken
        } catch (e) {
            console.warn("Failed to refresh token before upload", e)
        }

        // Upload each file
        for (const placeholder of newPlaceholders) {
            const formData = new FormData()
            formData.append("file", placeholder.file)

            try {
                const response = await fetch("/api/media/upload", {
                    method: "POST",
                    body: formData,
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                        // Note: Content-Type header is NOT set here to allow browser to set boundary
                    }
                })

                if (!response.ok) {
                    let errorMsg = `Upload failed: ${response.status} ${response.statusText}`
                    try {
                        const errData = await response.json()
                        if (errData.error) errorMsg += ` - ${errData.error}`
                    } catch {
                        // ignore json parse error
                    }
                    throw new Error(errorMsg)
                }

                const data = await response.json()

                // Update specific image status
                setUploadedImages((prev) =>
                    prev.map((img) =>
                        img.id === placeholder.id
                            ? {
                                  ...img,
                                  id: data.id,
                                  status: "completed",
                                  previewUrl: `/api/image/${data.id}?variant=thumb`
                              }
                            : img
                    )
                )
            } catch (err) {
                console.error("Image upload error", err)
                // Mark as error
                setUploadedImages((prev) =>
                    prev.map((img) => (img.id === placeholder.id ? { ...img, status: "error" } : img))
                )
                setError("Nie udało się przesłać niektórych zdjęć.")
            }
        }
    }

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        const files = Array.from(e.target.files)
        await handleFiles(files)

        // Reset file input
        e.target.value = ""
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (uploadedImages.length < 5 && !isUploading) {
            setIsDragging(true)
        }
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        if (uploadedImages.length >= 5 || isUploading) return

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))
            if (droppedFiles.length > 0) {
                await handleFiles(droppedFiles)
            } else {
                setError("Proszę upuścić tylko pliki obrazów (JPG, PNG).")
            }
        }
    }

    const handleRemoveImage = (id: string) => {
        setUploadedImages((prev) => prev.filter((img) => img.id !== id))
    }

    const handleLocationSelect = useCallback((lat: number, lng: number) => {
        setFormData((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lng
        }))
    }, [])

    // Accept AI suggested category
    const acceptAISuggestion = () => {
        if (aiSuggestedCategory) {
            const mappedCategory = mapAICategoryToValue(aiSuggestedCategory.category)
            setFormData((prev) => ({ ...prev, category: mappedCategory }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Block submit if uploads are in progress
        if (isUploading) {
            setError("Proszę poczekać na zakończenie przesyłania zdjęć.")
            return
        }

        setIsSubmitting(true)
        setError(null)
        setSubmissionResult(null)

        // Get successfully uploaded image IDs
        const finalImageIds = uploadedImages.filter((img) => img.status === "completed").map((img) => img.id)

        // Comprehensive validation using Zod schema
        const validationResult = validateReport({
            title: formData.title,
            description: formData.description,
            category: formData.category,
            latitude: formData.latitude,
            longitude: formData.longitude,
            imageIds: finalImageIds
        })

        if (!validationResult.success) {
            // Display validation errors
            const errorEntries = Object.entries(validationResult.errors || {})
            if (errorEntries.length > 0) {
                const [field, message] = errorEntries[0]
                if (field === "latitude" || field === "longitude") {
                    setError("Proszę wybrać prawidłową lokalizację na mapie")
                } else {
                    setError(message as string)
                }
                setFieldErrors(
                    Object.fromEntries(errorEntries.filter(([key]) => key !== "latitude" && key !== "longitude")) as Record<
                        string,
                        string
                    >
                )
            }
            setIsSubmitting(false)
            return
        }

        const accessToken = localStorage.getItem("access_token")

        try {
            // Images are already uploaded
            const imageIds = finalImageIds

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

                // Check if it's a validation error from backend
                if (errorData.error && typeof errorData.error === "string") {
                    const errorStr = errorData.error
                    const newFieldErrors: { title?: string; description?: string } = {}

                    // Parse field-level errors (format: "field: message, field: message")
                    // Looking for field names in both English and references in Polish messages
                    if (errorStr.toLowerCase().includes("title:") || errorStr.toLowerCase().includes("tytuł")) {
                        const titleMatch = errorStr.match(/title:\s*([^,]+)/i)
                        if (titleMatch) {
                            newFieldErrors.title = titleMatch[1].trim()
                        } else {
                            // Extract the message directly if it contains "tytuł"
                            const parts = errorStr.split(",")
                            for (const part of parts) {
                                if (part.toLowerCase().includes("tytuł")) {
                                    const colonIndex = part.indexOf(":")
                                    const msg = colonIndex > 0 ? part.substring(colonIndex + 1) : part
                                    newFieldErrors.title = msg.trim()
                                    break
                                }
                            }
                        }
                    }

                    if (errorStr.toLowerCase().includes("description:") || errorStr.toLowerCase().includes("opis")) {
                        const descMatch = errorStr.match(/description:\s*([^,]+)/i)
                        if (descMatch) {
                            newFieldErrors.description = descMatch[1].trim()
                        } else {
                            // Extract the message directly if it contains "opis"
                            const parts = errorStr.split(",")
                            for (const part of parts) {
                                if (part.toLowerCase().includes("opis")) {
                                    const colonIndex = part.indexOf(":")
                                    const msg = colonIndex > 0 ? part.substring(colonIndex + 1) : part
                                    newFieldErrors.description = msg.trim()
                                    break
                                }
                            }
                        }
                    }

                    if (
                        errorStr.toLowerCase().includes("latitude:") ||
                        errorStr.toLowerCase().includes("longitude:") ||
                        errorStr.toLowerCase().includes("szerokość") ||
                        errorStr.toLowerCase().includes("długość")
                    ) {
                        setError("Nieprawidłowe współrzędne lokalizacji")
                    }

                    // Set field errors if we found any
                    if (Object.keys(newFieldErrors).length > 0) {
                        setFieldErrors(newFieldErrors)
                        setIsSubmitting(false)
                        return
                    }
                }

                // Generic error fallback
                throw new Error(errorData.error || errorData.message || "Nie udało się utworzyć zgłoszenia")
            }

            const createdReport = await response.json()
            const reportId = createdReport.id || `report-${Date.now()}`

            // AI Verification commented out - auto-acceptance disabled
            /* 
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
                // Fully accepted - redirect after showing success with countdown
                setSuccess(true)
            } else if (verificationResult.requiresReview) {
                // Needs review - show message with countdown
                setSuccess(true)
            } else {
                // Rejected - show error
                setError(verificationResult.message)
            }
            */

            // Manual success fallback
            setSuccess(true)
            setSubmissionResult({
                accepted: true,
                requiresReview: true,
                message: "Zgłoszenie zostało wysłane i trafiło do weryfikacji.",
                verification: null,
                reportId: reportId
            })
            setTimeout(() => {
                window.location.href = "/"
            }, 2500)
        } catch (err: unknown) {
            // Only show general errors in the error box (non-field specific)
            const errorMessage = err instanceof Error ? err.message : "Wystąpił błąd podczas tworzenia zgłoszenia"

            // Don't show field-specific errors in the general error box
            if (!errorMessage.includes("znak") && !errorMessage.includes("Title") && !errorMessage.includes("Description")) {
                setError(errorMessage)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    // Countdown timer for redirect
    useEffect(() => {
        if (success) {
            const timer = setInterval(() => {
                setCountdown((prev) => prev - 1)
            }, 1000)

            return () => clearInterval(timer)
        }
    }, [success])

    // Handle redirect when countdown reaches 0
    useEffect(() => {
        if (success && countdown === 0) {
            router.push("/")
        }
    }, [success, countdown, router])

    if (success && submissionResult) {
        const isVerified = !submissionResult.requiresReview

        return (
            <div className="flex min-h-screen items-center justify-center bg-[#2a221a] p-4">
                <div className="w-full max-w-md rounded-xl bg-[#362c20] p-8 text-center">
                    {/* Animated Icon */}
                    <div className="mb-6 flex justify-center">
                        {isVerified ? (
                            // Success Animation - Checkmark
                            <div className="relative">
                                <div className="absolute inset-0 animate-ping rounded-full bg-green-500/30"></div>
                                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20 ring-4 ring-green-500/50">
                                    <span className="material-symbols-outlined animate-bounce text-6xl text-green-500">
                                        check_circle
                                    </span>
                                </div>
                            </div>
                        ) : (
                            // Pending Animation - Clock
                            <div className="relative">
                                <div className="absolute inset-0 animate-pulse rounded-full bg-yellow-500/30"></div>
                                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-yellow-500/20 ring-4 ring-yellow-500/50">
                                    <span className="material-symbols-outlined slow-spin text-6xl text-yellow-500">
                                        schedule
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <h2 className="mb-3 text-2xl font-bold text-[#e0dcd7]">
                        {isVerified ? (
                            <span className="animate-pulse">✅ Zgłoszenie zaakceptowane!</span>
                        ) : (
                            <span className="animate-pulse">⏳ Zgłoszenie przyjęte!</span>
                        )}
                    </h2>

                    {/* Message */}
                    <p className="mb-6 text-base text-[#e0dcd7]/80">
                        {isVerified ? (
                            <>
                                <span className="font-semibold text-green-400">
                                    AI zweryfikowało zgłoszenie jako autentyczne.
                                </span>
                                <br />
                                Twoje zgłoszenie jest teraz widoczne na mapie.
                            </>
                        ) : (
                            <>
                                <span className="font-semibold text-yellow-400">
                                    Zgłoszenie oczekuje na sprawdzenie przez moderatora.
                                </span>
                                <br />
                                Otrzymasz powiadomienie po weryfikacji.
                            </>
                        )}
                    </p>

                    {/* Countdown */}
                    <div className="mb-4 rounded-lg bg-[#2a221a] p-4">
                        <p className="mb-2 text-sm text-[#e0dcd7]/70">Przeniesienie do mapy nastąpi za:</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="animate-pulse text-5xl font-bold text-[#d97706]">{countdown}</span>
                            <span className="text-2xl text-[#e0dcd7]/50">s</span>
                        </div>
                    </div>

                    {/* Loading Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#2a221a]">
                        <div
                            className="h-full bg-gradient-to-r from-[#d97706] to-green-500 transition-all duration-1000 ease-linear"
                            style={{ width: `${((3 - countdown) / 3) * 100}%` }}
                        ></div>
                    </div>

                    {/* Skip button */}
                    <button
                        onClick={() => router.push("/")}
                        className="mt-6 text-sm text-[#e0dcd7]/50 underline transition-colors hover:text-[#d97706]"
                    >
                        Pomiń i przejdź teraz
                    </button>
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
                    {/* Only show general errors at top (like location) */}
                    {error && !error.includes("Tytuł") && !error.includes("Opis") && (
                        <div className="rounded-lg border border-red-500 bg-red-500/20 p-4 text-red-200">{error}</div>
                    )}

                    {/* Title */}
                    <div>
                        <label htmlFor="title" className="mb-2 block font-semibold text-[#e0dcd7]">
                            Tytuł zgłoszenia *
                            <span className="ml-2 text-xs font-normal text-[#e0dcd7]/50">({formData.title.length}/500)</span>
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            required
                            maxLength={500}
                            value={formData.title}
                            onChange={handleInputChange}
                            className={`w-full rounded-lg border ${fieldErrors.title ? "border-red-500" : "border-[#e0dcd7]/20"} bg-[#2a221a] px-4 py-3 text-[#e0dcd7] transition-colors focus:border-[#d97706] focus:outline-none`}
                            placeholder="np. Uszkodzony chodnik"
                        />
                        {fieldErrors.title && <p className="mt-1 text-sm text-red-400">{fieldErrors.title}</p>}
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
                                        <p className="font-medium text-[#e0dcd7]">
                                            {aiSuggestedCategory.category_label || aiSuggestedCategory.category}
                                        </p>
                                        <p className="mt-1 text-xs text-[#e0dcd7]/60">
                                            Pewność: {(aiSuggestedCategory.confidence * 100).toFixed(0)}%
                                            {aiSuggestedCategory.demo_mode && (
                                                <span className="ml-2 text-[#d97706]/70">(tryb demo)</span>
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={acceptAISuggestion}
                                        className="rounded-md bg-[#d97706] px-3 py-1.5 text-sm text-[#120c07] transition-colors hover:bg-[#d97706]/80"
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
                        <p className="mb-2 text-xs text-[#e0dcd7]/60">
                            Możesz dodać szczegółowy opis (maksymalnie 10000 znaków)
                        </p>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            maxLength={10000}
                            rows={8}
                            className={`w-full resize-none rounded-lg border ${fieldErrors.description ? "border-yellow-500" : "border-[#e0dcd7]/20"} bg-[#2a221a] px-4 py-3 text-[#e0dcd7] transition-colors focus:border-[#d97706] focus:outline-none`}
                            placeholder="Opisz dokładnie problem..."
                        />
                        <div className="mt-1 flex items-center justify-between">
                            {formData.description.length > 0 && (
                                <p className="text-xs text-[#e0dcd7]/50">{formData.description.length}/10000 znaków</p>
                            )}
                            {fieldErrors.description && <p className="text-sm text-yellow-400">{fieldErrors.description}</p>}
                        </div>
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
                            Zdjęcia (maksymalnie 5)
                        </label>

                        <div className="space-y-4">
                            {/* Hidden File Input */}
                            <input
                                type="file"
                                id="images"
                                accept="image/*"
                                multiple
                                onChange={handleImageChange}
                                disabled={uploadedImages.length >= 5 || isUploading}
                                className="hidden"
                            />

                            {/* Custom Upload Button / Drop Zone */}
                            <label
                                htmlFor="images"
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-[#2a221a] py-8 transition-all duration-200 ${
                                    uploadedImages.length >= 5 || isUploading
                                        ? "cursor-not-allowed border-[#e0dcd7]/20 opacity-50"
                                        : isDragging
                                          ? "scale-[1.02] border-[#d97706] bg-[#d97706]/10 shadow-[0_0_15px_rgba(217,119,6,0.3)]"
                                          : "border-[#e0dcd7]/20 hover:border-[#d97706] hover:bg-[#d97706]/5"
                                }`}
                            >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <span
                                        className={`material-symbols-outlined mb-2 text-4xl transition-colors ${
                                            isDragging ? "text-[#d97706]" : "text-[#e0dcd7]"
                                        }`}
                                    >
                                        {isDragging ? "cloud_upload" : "add_photo_alternate"}
                                    </span>
                                    <p className="mb-2 text-sm text-[#e0dcd7]">
                                        {isDragging ? (
                                            <span className="font-bold text-[#d97706]">Upuść zdjęcia tutaj!</span>
                                        ) : (
                                            <span className="font-semibold">Kliknij lub przeciągnij zdjęcia</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-[#e0dcd7]/60">JPG, PNG (maks. 5 zdjęć)</p>
                                </div>
                            </label>

                            {/* Persistent Error Message for Limits */}
                            {error && error.includes("Wybrano") && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">warning</span>
                                        <span>{error}</span>
                                    </div>
                                </div>
                            )}

                            {/* Image Previews */}
                            {uploadedImages.length > 0 && (
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                                    {uploadedImages.map((img) => (
                                        <div
                                            key={img.id}
                                            className="relative aspect-square overflow-hidden rounded-lg bg-[#2a221a] ring-1 ring-[#e0dcd7]/20"
                                        >
                                            {/* Preview Image */}
                                            <img
                                                src={img.previewUrl}
                                                alt="Podgląd"
                                                className={`h-full w-full object-cover transition-opacity ${img.status === "uploading" ? "opacity-50" : "opacity-100"}`}
                                            />

                                            {/* Status Indicators */}
                                            {img.status === "uploading" && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="material-symbols-outlined animate-spin text-[#d97706]">
                                                        sync
                                                    </span>
                                                </div>
                                            )}

                                            {img.status === "error" && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-red-500/50">
                                                    <span className="material-symbols-outlined text-white">error</span>
                                                </div>
                                            )}

                                            {/* Remove Overlay (on hover or always visible for better UX) */}
                                            <div className="absolute top-1 right-1 z-10">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveImage(img.id)}
                                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 shadow-sm transition-transform hover:scale-110 hover:bg-red-700"
                                                    title="Usuń zdjęcie"
                                                >
                                                    <span className="material-symbols-outlined text-sm font-bold text-white">
                                                        close
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="text-xs text-[#e0dcd7]/60">
                                {uploadedImages.length}/5 zdjęć. Obsługiwane formaty: JPG, PNG.
                            </p>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.latitude || !formData.longitude || isUploading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d97706] px-6 py-4 text-lg font-bold text-[#120c07] transition-colors hover:bg-[#d97706]/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isUploading && <span className="material-symbols-outlined animate-spin">sync</span>}
                        <span className="material-symbols-outlined">send</span>
                        {isSubmitting ? "Wysyłanie..." : isUploading ? "Wysyłanie zdjęć..." : "Wyślij Zgłoszenie"}
                    </button>

                    {isSubmitting && <p className="text-center text-sm text-[#e0dcd7]/60">Wysyłanie zgłoszenia...</p>}
                </form>
            </div>
        </div>
    )
}
