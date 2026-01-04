'use client'

import { useState, useTransition } from 'react'
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
    'VANDALISM': 'Wandalizm',
    'INFRASTRUCTURE': 'Infrastruktura drogowa/chodników',
    'DANGEROUS_SITUATION': 'Niebezpieczne sytuacje',
    'TRAFFIC_ACCIDENT': 'Wypadki drogowe',
    'PARTICIPANT_BEHAVIOR': 'Zachowania kierowców/pieszych',
    'PARTICIPANT_HAZARD': 'Zagrożenia dla pieszych i rowerzystów i kierowców',
    'WASTE_ILLEGAL_DUMPING': 'Śmieci/nielegalne zaśmiecanie/nielegalne wysypiska śmieci',
    'BIOLOGICAL_HAZARD': 'Zagrożenia biologiczne',
    'OTHER': 'Inne'
}

export function ReportCard({ report }: { report: Report }) {
    const [isPending, startTransition] = useTransition()
    const [isExpanded, setIsExpanded] = useState(false)
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
    
    const hasImages = report.imageIds && report.imageIds.length > 0
    const MEDIA_SERVICE_BASE_URL = 'http://localhost:8084/media/'

    // Determine AI status based on report data
    const getAIStatusInfo = () => {
        if (!report.aiIsFake || report.status === 'PENDING') {
            return { show: false }
        }

        const confidence = report.aiConfidence || ''
        const confidenceLabels: Record<string, string> = {
            'high': 'Wysoka pewność',
            'medium': 'Średnia pewność',
            'low': 'Niska pewność'
        }

        if (report.status === 'REJECTED') {
            return {
                show: true,
                isFake: true,
                probability: report.aiFakeProbability || 0,
                confidence: confidenceLabels[confidence] || confidence,
                message: 'Przekazano do sprawdzenia przez moderatora',
                description: 'AI wykryło potencjalne problemy z treścią zgłoszenia'
            }
        } else if (report.status === 'VERIFIED') {
            return {
                show: true,
                isFake: false,
                probability: report.aiFakeProbability || 0,
                confidence: confidenceLabels[confidence] || confidence,
                message: 'Zweryfikowano automatycznie',
                description: 'AI potwierdziło autentyczność zgłoszenia'
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
        if (!confirm('Czy na pewno chcesz odrzucić to zgłoszenie?')) return

        startTransition(async () => {
            const result = await rejectReport(report.id)
            if (!result.success) {
                alert(`Błąd: ${result.error}`)
            }
        })
    }

    return (
        <SectionCard className="bg-[#362c20] border-[#e0dcd7]/10 relative overflow-hidden">
            {/* Success Animation Overlay */}
            {showSuccessAnimation && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-green-500/20 backdrop-blur-sm animate-fadeIn">
                    <div className="text-center animate-bounce">
                        <div className="text-6xl mb-2">✓</div>
                        <div className="text-green-400 font-bold text-lg">Zaakceptowano!</div>
                    </div>
                </div>
            )}
            
            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-[#e0dcd7]">
                            {report.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-[#d97706]">
                                {CATEGORY_DISPLAY_NAMES[report.category] || report.category}
                            </p>
                            {/* AI Sparkle Animation */}
                            <div className="relative inline-flex">
                                <span className="text-yellow-400 text-xs animate-pulse">✨</span>
                                <span className="absolute -top-1 -right-1 text-yellow-300 text-[8px] animate-ping">✨</span>
                            </div>
                            <span className="text-[10px] text-blue-400 font-medium">AI</span>
                        </div>
                    </div>
                    {report.status === 'VERIFIED' && (
                        <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                            ✓ Zweryfikowany
                        </span>
                    )}
                    {report.status === 'REJECTED' && (
                        <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                            ✗ Odrzucony
                        </span>
                    )}
                    {report.status === 'PENDING' && (
                        <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                            ⏳ Oczekuje na sprawdzenie
                        </span>
                    )}
                </div>

                {/* Description */}
                {report.description && (
                    <p className="text-[#e0dcd7]/80 text-sm">
                        {report.description}
                    </p>
                )}

                {/* AI Verification Results */}
                {aiStatus.show && (
                    <div className="p-3 rounded-lg bg-black/20 border border-[#e0dcd7]/10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-sm text-blue-400">psychology</span>
                            <span className="text-xs font-semibold text-blue-400">Szczegóły analizy AI</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-[#e0dcd7]/70">Wynik:</span>
                                <span className={`px-2 py-1 rounded font-medium ${
                                    aiStatus.isFake 
                                        ? 'bg-red-500/20 text-red-400' 
                                        : 'bg-green-500/20 text-green-400'
                                }`}>
                                    {aiStatus.isFake ? '✗ Podejrzane' : '✓ Autentyczne'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#e0dcd7]/70">Prawdopodobieństwo:</span>
                                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 font-medium">
                                    {(aiStatus.probability! * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#e0dcd7]/70">Pewność AI:</span>
                                <span className={`px-2 py-1 rounded font-medium ${
                                    aiStatus.confidence === 'Wysoka pewność' ? 'bg-green-500/20 text-green-400' :
                                    aiStatus.confidence === 'Średnia pewność' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-orange-500/20 text-orange-400'
                                }`}>
                                    {aiStatus.confidence}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-[#e0dcd7]/10">
                                <span className="text-[#e0dcd7]/70">Status:</span>
                                <span className={`px-2 py-1 rounded font-medium ${
                                    aiStatus.isFake 
                                        ? 'bg-orange-500/20 text-orange-400' 
                                        : 'bg-green-500/20 text-green-400'
                                }`}>
                                    {aiStatus.message}
                                </span>
                            </div>
                            <div className="text-[#e0dcd7]/60 text-[11px] italic mt-2">
                                💡 {aiStatus.description}
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
                    {report.createdAt && (
                        <span>
                            {new Date(report.createdAt).toLocaleDateString('pl-PL')}
                        </span>
                    )}
                </div>

                {/* Photos Gallery */}
                {isExpanded && hasImages && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 p-2 bg-black/20 rounded-lg">
                        {report.imageIds!.map((imageId) => (
                            <div key={imageId} className="relative aspect-square rounded-md overflow-hidden bg-zinc-800">
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
                        {isPending ? 'Przetwarzanie...' : '✓ Potwierdź'}
                    </button>
                    <button
                        onClick={handleReject}
                        disabled={isPending}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                    >
                        {isPending ? '...' : '✗ Odrzuć'}
                    </button>

                    {hasImages ? (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="px-4 py-2 rounded-lg bg-[#362c20] hover:bg-[#362c20]/80 text-[#e0dcd7] text-sm font-medium transition-colors border border-[#e0dcd7]/20"
                        >
                            {isExpanded ? 'Ukryj zdjęcia' : 'Pokaż zdjęcia'}
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
