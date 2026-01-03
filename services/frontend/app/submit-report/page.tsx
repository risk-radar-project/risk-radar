'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import map component (client-side only)
const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[400px] rounded-lg bg-[#362c20] flex items-center justify-center">
            <div className="text-[#e0dcd7] text-lg">Ładowanie mapy...</div>
        </div>
    )
})

type ReportCategory =
    | 'VANDALISM'
    | 'INFRASTRUCTURE'
    | 'DANGEROUS_SITUATION'
    | 'TRAFFIC_ACCIDENT'
    | 'PARTICIPANT_BEHAVIOR'
    | 'PARTICIPANT_HAZARD'
    | 'WASTE_ILLEGAL_DUMPING'
    | 'BIOLOGICAL_HAZARD'
    | 'OTHER'

interface CategoryOption {
    value: ReportCategory
    label: string
    icon: string
}

const CATEGORIES: CategoryOption[] = [
    { value: 'VANDALISM', label: 'Wandalizm', icon: 'format_paint' },
    { value: 'INFRASTRUCTURE', label: 'Infrastruktura drogowa/chodników', icon: 'construction' },
    { value: 'DANGEROUS_SITUATION', label: 'Niebezpieczne sytuacje', icon: 'warning' },
    { value: 'TRAFFIC_ACCIDENT', label: 'Wypadki drogowe', icon: 'car_crash' },
    { value: 'PARTICIPANT_BEHAVIOR', label: 'Zachowania kierowców/pieszych', icon: 'person_alert' },
    { value: 'PARTICIPANT_HAZARD', label: 'Zagrożenia dla pieszych i rowerzystów i kierowców', icon: 'brightness_alert' },
    { value: 'WASTE_ILLEGAL_DUMPING', label: 'Śmieci/nielegalne zaśmiecanie/nielegalne wysypiska śmieci', icon: 'delete_sweep' },
    { value: 'BIOLOGICAL_HAZARD', label: 'Zagrożenia biologiczne', icon: 'bug_report' },
    { value: 'OTHER', label: 'Inne', icon: 'help_outline' }
]

export default function SubmitReportPage() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        latitude: null as number | null,
        longitude: null as number | null,
        category: 'OTHER' as ReportCategory,
        images: [] as File[]
    })

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFormData(prev => ({ ...prev, images: Array.from(e.target.files || []) }))
        }
    }

    const handleLocationSelect = (lat: number, lng: number) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)

        // Validate location
        if (formData.latitude === null || formData.longitude === null) {
            setError('Proszę wybrać lokalizację na mapie')
            setIsSubmitting(false)
            return
        }

        const accessToken = localStorage.getItem('access_token')

        try {
            // First, upload images if any (one by one, as media-service accepts single file)
            let imageIds: string[] = []
            if (formData.images.length > 0) {
                for (const image of formData.images) {
                    const imageFormData = new FormData()
                    imageFormData.append('file', image)

                    const imageResponse = await fetch('/api/media/upload', {
                        method: 'POST',
                        body: imageFormData,
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    })

                    if (!imageResponse.ok) {
                        throw new Error('Nie udało się przesłać zdjęć')
                    }

                    const imageData = await imageResponse.json()
                    if (imageData.id) {
                        imageIds.push(imageData.id)
                    }
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
                userId: 'ea2698bc-9348-44f5-b64b-0b973da92da7' // Temporary UUID for development (same as media uploads)
            }

            const response = await fetch('/api/reports/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(reportData)
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Nie udało się utworzyć zgłoszenia')
            }

            setSuccess(true)
            setTimeout(() => {
                window.location.href = '/' // Force full page reload to ensure map loads
            }, 2000)
        } catch (err: any) {
            setError(err.message || 'Wystąpił błąd podczas tworzenia zgłoszenia')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#2a221a] flex items-center justify-center p-4">
                <div className="bg-[#362c20] rounded-xl p-8 max-w-md w-full text-center">
                    <div className="mb-4">
                        <span className="material-symbols-outlined text-green-500 text-6xl">check_circle</span>
                    </div>
                    <h2 className="text-2xl font-bold text-[#e0dcd7] mb-2">Zgłoszenie wysłane!</h2>
                    <p className="text-[#e0dcd7]/70 mb-4">Twoje zgłoszenie zostało pomyślnie utworzone.</p>
                    <p className="text-[#e0dcd7]/50 text-sm">Przekierowywanie do mapy...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#2a221a] py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 text-[#e0dcd7] hover:text-[#d97706] transition-colors mb-4"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span>Powrót do mapy</span>
                    </a>
                    <h1 className="text-4xl font-bold text-[#e0dcd7] mb-2">Zgłoś Nowe Zdarzenie</h1>
                    <p className="text-[#e0dcd7]/70">Wypełnij formularz, aby zgłosić nowe zdarzenie w Twojej okolicy</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-[#362c20] rounded-xl p-6 space-y-6">
                    {error && (
                        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-200">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label htmlFor="title" className="block text-[#e0dcd7] font-semibold mb-2">
                            Tytuł zgłoszenia *
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            required
                            value={formData.title}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-[#2a221a] text-[#e0dcd7] rounded-lg border border-[#e0dcd7]/20 focus:border-[#d97706] focus:outline-none transition-colors"
                            placeholder="np. Uszkodzony chodnik"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label htmlFor="category" className="block text-[#e0dcd7] font-semibold mb-2">
                            Kategoria *
                        </label>
                        <select
                            id="category"
                            name="category"
                            required
                            value={formData.category}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-[#2a221a] text-[#e0dcd7] rounded-lg border border-[#e0dcd7]/20 focus:border-[#d97706] focus:outline-none transition-colors"
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
                        <label htmlFor="description" className="block text-[#e0dcd7] font-semibold mb-2">
                            Opis
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows={4}
                            className="w-full px-4 py-3 bg-[#2a221a] text-[#e0dcd7] rounded-lg border border-[#e0dcd7]/20 focus:border-[#d97706] focus:outline-none transition-colors resize-none"
                            placeholder="Opisz dokładnie problem..."
                        />
                    </div>

                    {/* Location Map */}
                    <div>
                        <label className="block text-[#e0dcd7] font-semibold mb-2">
                            Lokalizacja * {formData.latitude && formData.longitude && (
                                <span className="text-[#d97706] text-sm font-normal ml-2">
                                    ✓ Wybrano
                                </span>
                            )}
                        </label>
                        <p className="text-[#e0dcd7]/60 text-sm mb-3">
                            Kliknij na mapie lub użyj przycisku lokalizacji w prawym dolnym rogu mapy
                        </p>
                        <LocationPickerMap onLocationSelect={handleLocationSelect} />
                    </div>

                    {/* Images */}
                    <div>
                        <label htmlFor="images" className="block text-[#e0dcd7] font-semibold mb-2">
                            Zdjęcia (opcjonalne)
                        </label>
                        <input
                            type="file"
                            id="images"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="w-full px-4 py-3 bg-[#2a221a] text-[#e0dcd7] rounded-lg border border-[#e0dcd7]/20 focus:border-[#d97706] focus:outline-none transition-colors file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#d97706] file:text-white file:font-semibold hover:file:bg-[#d97706]/80"
                        />
                        {formData.images.length > 0 && (
                            <p className="text-[#e0dcd7]/70 text-sm mt-2">
                                Wybrano {formData.images.length} {formData.images.length === 1 ? 'zdjęcie' : 'zdjęć'}
                            </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.latitude || !formData.longitude}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#d97706] hover:bg-[#d97706]/80 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">send</span>
                        {isSubmitting ? 'Wysyłanie...' : 'Wyślij Zgłoszenie'}
                    </button>
                </form>
            </div>
        </div>
    )
}
