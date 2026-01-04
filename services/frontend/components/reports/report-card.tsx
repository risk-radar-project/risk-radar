"use client"

import { useState, useTransition } from "react"
import { SectionCard } from "@/components/shared/section-card"
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

export function ReportCard({ report }: { report: Report }) {
    const [isPending, startTransition] = useTransition()
    const [isExpanded, setIsExpanded] = useState(false)
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)

    const hasImages = report.imageIds && report.imageIds.length > 0
    const MEDIA_SERVICE_BASE_URL = "http://localhost:8084/media/"

    // Determine AI status based on report data
    const getAIStatusInfo = () => {
        if (!report.aiIsFake || report.status === "PENDING") {
            return { show: false }
        }

        const confidence = report.aiConfidence || ""
        const confidenceLabels: Record<string, string> = {
            high: "Wysoka pewność",
            medium: "Średnia pewność",
            low: "Niska pewność"
        }

        if (report.status === "REJECTED") {
            return {
                show: true,
                isFake: true,
                probability: report.aiFakeProbability || 0,
                confidence: confidenceLabels[confidence] || confidence,
                message: "Przekazano do sprawdzenia przez moderatora",
                description: "AI wykryło potencjalne problemy z treścią zgłoszenia"
            }
        } else if (report.status === "VERIFIED") {
            return {
                show: true,
                isFake: false,
                probability: report.aiFakeProbability || 0,
                confidence: confidenceLabels[confidence] || confidence,
                message: "Zweryfikowano automatycznie",
                description: "AI potwierdziło autentyczność zgłoszenia"
            }
        }
        return { show: false }
    }

    const aiStatus = getAIStatusInfo()

    const handleVerify = () => {
        startTransition(async () => {
            const result = await verifyReport(report.id)
            if (!result.success) {
                alert(`Błąd: ${result.error}`)
            } else {
                // Show success animation
                setShowSuccessAnimation(true)
                setTimeout(() => setShowSuccessAnimation(false), 2000)
            }
        })
    }

    const handleReject = () => {
        if (!confirm("Czy na pewno chcesz odrzucić to zgłoszenie?")) return

        startTransition(async () => {
            const result = await rejectReport(report.id)
            if (!result.success) {
                alert(`Błąd: ${result.error}`)
            }
        })
    }

    return (
        <SectionCard className="relative overflow-hidden border-[#e0dcd7]/10 bg-[#362c20]">
            {/* Success Animation Overlay */}
            {showSuccessAnimation && (
                <div className="animate-fadeIn absolute inset-0 z-50 flex items-center justify-center bg-green-500/20 backdrop-blur-sm">
                    <div className="animate-bounce text-center">
                        <div className="mb-2 text-6xl">✓</div>
                        <div className="text-lg font-bold text-green-400">Zaakceptowano!</div>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-[#e0dcd7]">{report.title}</h3>
                        <div className="mt-1 flex items-center gap-2">
                            <p className="text-sm text-[#d97706]">
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
                {report.description && <p className="text-sm text-[#e0dcd7]/80">{report.description}</p>}

                {/* AI Verification Results */}
                {aiStatus.show && (
                    <div className="rounded-lg border border-[#e0dcd7]/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-blue-400">psychology</span>
                            <span className="text-xs font-semibold text-blue-400">Szczegóły analizy AI</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[#e0dcd7]/70">Wynik:</span>
                                <span
                                    className={`rounded px-2 py-1 font-medium ${aiStatus.isFake ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                                        }`}
                                >
                                    {aiStatus.isFake ? "✗ Podejrzane" : "✓ Autentyczne"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[#e0dcd7]/70">Prawdopodobieństwo:</span>
                                <span className="rounded bg-blue-500/20 px-2 py-1 font-medium text-blue-400">
                                    {(aiStatus.probability! * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[#e0dcd7]/70">Pewność AI:</span>
                                <span
                                    className={`rounded px-2 py-1 font-medium ${aiStatus.confidence === "Wysoka pewność"
                                            ? "bg-green-500/20 text-green-400"
                                            : aiStatus.confidence === "Średnia pewność"
                                                ? "bg-yellow-500/20 text-yellow-400"
                                                : "bg-orange-500/20 text-orange-400"
                                        }`}
                                >
                                    {aiStatus.confidence}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-[#e0dcd7]/10 pt-1">
                                <span className="text-[#e0dcd7]/70">Status:</span>
                                <span
                                    className={`rounded px-2 py-1 font-medium ${aiStatus.isFake
                                            ? "bg-orange-500/20 text-orange-400"
                                            : "bg-green-500/20 text-green-400"
                                        }`}
                                >
                                    {aiStatus.message}
                                </span>
                            </div>
                            <div className="mt-2 text-[11px] text-[#e0dcd7]/60 italic">💡 {aiStatus.description}</div>
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
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-black/20 p-2 sm:grid-cols-3">
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
                <div className="flex gap-3 border-t border-[#e0dcd7]/10 pt-2">
                    <button
                        onClick={handleVerify}
                        disabled={isPending}
                        className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                        {isPending ? "Przetwarzanie..." : "✓ Potwierdź"}
                    </button>
                    <button
                        onClick={handleReject}
                        disabled={isPending}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                        {isPending ? "..." : "✗ Odrzuć"}
                    </button>

                    {hasImages ? (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="rounded-lg border border-[#e0dcd7]/20 bg-[#362c20] px-4 py-2 text-sm font-medium text-[#e0dcd7] transition-colors hover:bg-[#362c20]/80"
                        >
                            {isExpanded ? "Ukryj zdjęcia" : "Pokaż zdjęcia"}
                        </button>
                    ) : (
                        <button
                            disabled
                            className="cursor-not-allowed rounded-lg border border-[#e0dcd7]/10 bg-transparent px-4 py-2 text-sm font-medium text-[#e0dcd7]/30"
                        >
                            Brak zdjęć
                        </button>
                    )}
                </div>
            </div>
        </SectionCard>
    )
}
