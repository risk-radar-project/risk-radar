"use client"

import { useState, useTransition } from "react"
import { verifyReport, rejectReport } from "@/app/reports/actions"

export interface Report {
    id: string
    latitude: number
    longitude: number
    title: string
    description?: string
    category: string
    imageIds?: string[]
    verified: boolean
    status?: string
    createdAt?: string
    // AI Verification data
    aiIsFake?: boolean
    aiFakeProbability?: number
    aiConfidence?: string
    aiVerifiedAt?: string
}

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
    VANDALISM: "Wandalizm",
    INFRASTRUCTURE: "Infrastruktura drogowa/chodników",
    DANGEROUS_SITUATION: "Niebezpieczne sytuacje",
    TRAFFIC_ACCIDENT: "Wypadki drogowe",
    PARTICIPANT_BEHAVIOR: "Zachowania kierowców/pieszych",
    PARTICIPANT_HAZARD: "Zagrożenia dla pieszych i rowerzystów i kierowców",
    WASTE_ILLEGAL_DUMPING: "Śmieci/nielegalne zaśmiecanie/nielegalne wysypiska śmieci",
    BIOLOGICAL_HAZARD: "Zagrożenia biologiczne",
    OTHER: "Inne"
}

interface ReportCardProps {
    report: Report
    onProcessed?: (id: string) => void
}

export function ReportCard({ report, onProcessed }: ReportCardProps) {
    const [isPending, startTransition] = useTransition()
    const [isExpanded, setIsExpanded] = useState(false)
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
    const [showRejectAnimation, setShowRejectAnimation] = useState(false)

    const hasImages = report.imageIds && report.imageIds.length > 0
    const MEDIA_SERVICE_BASE_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8084/media/"

    // Determine AI status based on report data
    // Simplified: only show accepted/rejected feedback to user
    const getAIStatusInfo = () => {
        // Only show status info for VERIFIED or REJECTED reports
        if (report.status === "PENDING") {
            return { show: false }
        }

        if (report.status === "REJECTED") {
            return {
                show: true,
                isAccepted: false,
                message: "Odrzucone",
                description: "Zgłoszenie zostało odrzucone przez system weryfikacji"
            }
        } else if (report.status === "VERIFIED") {
            return {
                show: true,
                isAccepted: true,
                message: "Zaakceptowane",
                description: "Zgłoszenie zostało zaakceptowane"
            }
        }
        return { show: false }
    }

    const aiStatus = getAIStatusInfo()

    const handleVerify = () => {
        const token = localStorage.getItem("access_token")
        if (!token) {
            alert("Błąd: Brak tokenu autoryzacji. Zaloguj się ponownie.")
            return
        }

        startTransition(async () => {
            const result = await verifyReport(report.id, token)
            if (!result.success) {
                alert(`Błąd: ${result.error}`)
            } else {
                // Show success animation
                setShowSuccessAnimation(true)
                setTimeout(() => {
                    setShowSuccessAnimation(false)
                    if (onProcessed) onProcessed(report.id)
                }, 2000)
            }
        })
    }

    const handleReject = () => {
        if (!confirm("Czy na pewno chcesz odrzucić to zgłoszenie?")) return

        const token = localStorage.getItem("access_token")
        if (!token) {
            alert("Błąd: Brak tokenu autoryzacji. Zaloguj się ponownie.")
            return
        }

        startTransition(async () => {
            const result = await rejectReport(report.id, token)
            if (!result.success) {
                alert(`Błąd: ${result.error}`)
            } else {
                // Show reject animation
                setShowRejectAnimation(true)
                setTimeout(() => {
                    setShowRejectAnimation(false)
                    if (onProcessed) onProcessed(report.id)
                }, 2000)
            }
        })
    }

    return (
        <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            {/* Success Animation Overlay */}
            {showSuccessAnimation && (
                <div className="animate-fadeIn absolute inset-0 z-50 flex items-center justify-center bg-green-500/20 backdrop-blur-sm">
                    <div className="animate-bounce text-center">
                        <div className="mb-2 text-6xl">✓</div>
                        <div className="text-lg font-bold text-green-400">Zaakceptowano!</div>
                    </div>
                </div>
            )}

            {/* Reject Animation Overlay */}
            {showRejectAnimation && (
                <div className="animate-fadeIn absolute inset-0 z-50 flex items-center justify-center bg-red-500/20 backdrop-blur-sm">
                    <div className="animate-bounce text-center">
                        <div className="mb-2 text-6xl">✗</div>
                        <div className="text-lg font-bold text-red-400">Odrzucono!</div>
                    </div>
                </div>
            )}

            <div className="space-y-3 p-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-zinc-100">{report.title}</h3>
                        <div className="mt-1 flex items-center gap-2">
                            <p className="text-sm text-blue-400">
                                {CATEGORY_DISPLAY_NAMES[report.category] || report.category}
                            </p>
                            {/* AI Sparkle Animation */}
                            <div className="relative inline-flex">
                                <span className="animate-pulse text-xs text-yellow-400">✨</span>
                                <span className="absolute -top-1 -right-1 animate-ping text-[8px] text-yellow-300">✨</span>
                            </div>
                            <span className="text-[10px] font-medium text-blue-400">AI</span>
                        </div>
                    </div>
                    {report.status === "VERIFIED" && (
                        <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">
                            ✓ Zweryfikowany
                        </span>
                    )}
                    {report.status === "REJECTED" && (
                        <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400">
                            ✗ Odrzucony
                        </span>
                    )}
                    {report.status === "PENDING" && (
                        <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-400">
                            ⏳ Oczekuje na sprawdzenie
                        </span>
                    )}
                </div>

                {/* Description */}
                {report.description && <p className="text-sm text-zinc-400">{report.description}</p>}

                {/* AI Verification Results - Simplified feedback for user */}
                {aiStatus.show && (
                    <div
                        className={`rounded-lg border p-3 ${
                            aiStatus.isAccepted ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className={`text-lg ${aiStatus.isAccepted ? "text-green-400" : "text-red-400"}`}>
                                {aiStatus.isAccepted ? "✓" : "✗"}
                            </span>
                            <div>
                                <span
                                    className={`text-sm font-semibold ${
                                        aiStatus.isAccepted ? "text-green-400" : "text-red-400"
                                    }`}
                                >
                                    {aiStatus.message}
                                </span>
                                <p className="text-xs text-[#e0dcd7]/60">{aiStatus.description}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Location info */}
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                    </span>
                    {report.createdAt && <span>{new Date(report.createdAt).toLocaleDateString("pl-PL")}</span>}
                </div>

                {/* Photos Gallery */}
                {isExpanded && hasImages && (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-zinc-800/50 p-2 sm:grid-cols-3">
                        {report.imageIds!.map((imageId) => (
                            <div key={imageId} className="relative aspect-square overflow-hidden rounded-md bg-zinc-800">
                                <img
                                    src={`${MEDIA_SERVICE_BASE_URL}${imageId}/preview`}
                                    alt="Zdjęcie zgłoszenia"
                                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 border-t border-zinc-800 pt-3">
                    <button
                        onClick={handleVerify}
                        disabled={isPending}
                        className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
                    >
                        {isPending ? "Przetwarzanie..." : "✓ Potwierdź"}
                    </button>
                    <button
                        onClick={handleReject}
                        disabled={isPending}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                    >
                        {isPending ? "..." : "✗ Odrzuć"}
                    </button>

                    {hasImages ? (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                        >
                            {isExpanded ? "Ukryj zdjęcia" : "Pokaż zdjęcia"}
                        </button>
                    ) : (
                        <button
                            disabled
                            className="cursor-not-allowed rounded-lg border border-zinc-800 bg-transparent px-4 py-2 text-sm font-medium text-zinc-600"
                        >
                            Brak zdjęć
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
