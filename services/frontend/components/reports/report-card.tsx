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
    createdAt?: string
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
    const hasImages = report.imageIds && report.imageIds.length > 0
    const MEDIA_SERVICE_BASE_URL = "http://localhost:8084/media/"

    const handleVerify = () => {
        startTransition(async () => {
            const result = await verifyReport(report.id)
            if (!result.success) {
                alert(`Błąd: ${result.error}`)
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
        <SectionCard className="bg-[#362c20] border-[#e0dcd7]/10">
            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-[#e0dcd7]">{report.title}</h3>
                        <p className="text-sm text-[#d97706] mt-1">
                            {CATEGORY_DISPLAY_NAMES[report.category] || report.category}
                        </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                        Oczekuje
                    </span>
                </div>

                {/* Description */}
                {report.description && <p className="text-[#e0dcd7]/80 text-sm">{report.description}</p>}

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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 p-2 bg-black/20 rounded-lg">
                        {report.imageIds!.map((imageId) => (
                            <div key={imageId} className="relative aspect-square rounded-md overflow-hidden bg-zinc-800">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`${MEDIA_SERVICE_BASE_URL}${imageId}/preview`}
                                    alt="Zdjęcie zgłoszenia"
                                    className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-2 border-t border-[#e0dcd7]/10">
                    <button
                        onClick={handleVerify}
                        disabled={isPending}
                        className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                    >
                        {isPending ? "Przetwarzanie..." : "✓ Potwierdź"}
                    </button>
                    <button
                        onClick={handleReject}
                        disabled={isPending}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                    >
                        {isPending ? "..." : "✗ Odrzuć"}
                    </button>

                    {hasImages ? (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="px-4 py-2 rounded-lg bg-[#362c20] hover:bg-[#362c20]/80 text-[#e0dcd7] text-sm font-medium transition-colors border border-[#e0dcd7]/20"
                        >
                            {isExpanded ? "Ukryj zdjęcia" : "Pokaż zdjęcia"}
                        </button>
                    ) : (
                        <button
                            disabled
                            className="px-4 py-2 rounded-lg bg-transparent text-[#e0dcd7]/30 text-sm font-medium border border-[#e0dcd7]/10 cursor-not-allowed"
                        >
                            Brak zdjęć
                        </button>
                    )}
                </div>
            </div>
        </SectionCard>
    )
}
