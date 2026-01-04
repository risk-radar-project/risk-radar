"use client"

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { JwtPayload, parseJwt } from '@/lib/auth/jwt-utils'

const MEDIA_SERVICE_BASE_URL = "/api/image/"

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

// Export Report interface so it can be used in page.tsx
export interface Report {
    id: string
    latitude: number
    longitude: number
    title: string
    description?: string
    category: string
    imageIds?: string[]
}

interface SearchResult {
    place_id: number
    display_name: string
    lat: string
    lon: string
}

interface MapComponentProps {
    initialReports?: Report[]
}

export default function MapComponent({ initialReports = [] }: MapComponentProps) {
    const mapRef = useRef<L.Map | null>(null)
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const markersRef = useRef<L.MarkerClusterGroup | null>(null)
    const displayedReportIdsRef = useRef<Set<string>>(new Set())
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const userLocationMarkerRef = useRef<L.Marker | null>(null)
    const userLocationCircleRef = useRef<L.Circle | null>(null)

    const [lightboxImage, setLightboxImage] = useState<string | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [showResults, setShowResults] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem("access_token")
        if (token) {
            const user = parseJwt(token)
            if (user) {
                const permissions = user.permissions || []
                const roles = user.roles || []

                const hasAdminAccess = permissions.includes("*:*") ||
                    permissions.includes("system:admin") ||
                    permissions.includes("PERM_SYSTEM_ADMIN") ||
                    roles.includes("ROLE_ADMIN")

                setIsAdmin(hasAdminAccess)
            }
        }
    }, [])

    // AI Assistant state
    const [aiLoading, setAiLoading] = useState(false)
    const [aiResponse, setAiResponse] = useState<{
        visible: boolean
        dangerLevel: string
        dangerScore: number
        summary: string
        reportsCount: number
    } | null>(null)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

    // Create user location icon (blue pulsing dot)
    const createUserLocationIcon = () => {
        const svgIcon = `
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="2">
                    <animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="fill-opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite"/>
                </circle>
                <circle cx="20" cy="20" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/>
            </svg>
        `
        const iconDataUrl = `data:image/svg+xml;base64,${btoa(svgIcon)}`

        return L.icon({
            iconUrl: iconDataUrl,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
        })
    }

    // Load Material Symbols & Leaflet CSS (CDN fallback)
    useEffect(() => {
        const links = [
            "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
            "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
            "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
        ]

        const addedLinks: HTMLLinkElement[] = []

        links.forEach((href) => {
            const link = document.createElement("link")
            link.href = href
            link.rel = "stylesheet"
            document.head.appendChild(link)
            addedLinks.push(link)
        })

        return () => {
            addedLinks.forEach((link) => document.head.removeChild(link))
        }
    }, [])

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest(".search-container")) {
                setShowResults(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Refresh map when sidebar toggles
    useEffect(() => {
        if (mapRef.current) {
            // Wait for transition to complete before invalidating size
            const timer = setTimeout(() => {
                mapRef.current?.invalidateSize()
            }, 350) // Slightly longer than transition-duration-300

            return () => clearTimeout(timer)
        }
    }, [sidebarOpen])

    // Force map refresh when component mounts or becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && mapRef.current) {
                setTimeout(() => {
                    mapRef.current?.invalidateSize()
                }, 100)
            }
        }

        // Invalidate immediately on mount
        if (mapRef.current) {
            setTimeout(() => {
                mapRef.current?.invalidateSize()
            }, 100)
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [])

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return

        // Initialize map centered on Kraków (where reports are located)
        const map = L.map(mapContainerRef.current, {
            attributionControl: false,
            zoomControl: false
        }).setView([50.06, 19.94], 9)
        mapRef.current = map

        // FIX: Clear the "displayed" set when the map is re-initialized.
        // This prevents the bug where HMR/Strict Mode re-creates the map,
        // but the Ref still thinks markers are already added.
        displayedReportIdsRef.current.clear()

        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            maxZoom: 19
        }).addTo(map)

        // Fix map rendering issues - invalidate size after initialization
        setTimeout(() => {
            map.invalidateSize()
        }, 100)

        // Additional invalidation after tiles load
        map.whenReady(() => {
            setTimeout(() => {
                map.invalidateSize()
            }, 200)
        })

        // Listen for tile loading to ensure proper rendering
        map.on("load", () => {
            map.invalidateSize()
        })

        // Add marker clustering
        const markers = L.markerClusterGroup()
        markersRef.current = markers
        map.addLayer(markers)

        // Icon configuration based on index.html
        const baseIconProps = {
            iconSize: [40, 40] as [number, number],
            iconAnchor: [20, 40] as [number, number],
            popupAnchor: [0, -40] as [number, number]
        }

        const categoryIcons: Record<string, L.Icon> = {
            VANDALISM: L.icon({ iconUrl: "/icons/format_paint.png", ...baseIconProps }),
            INFRASTRUCTURE: L.icon({ iconUrl: "/icons/construction.png", ...baseIconProps }),
            DANGEROUS_SITUATION: L.icon({ iconUrl: "/icons/warning.png", ...baseIconProps }),
            TRAFFIC_ACCIDENT: L.icon({ iconUrl: "/icons/car_crash.png", ...baseIconProps }),
            PARTICIPANT_BEHAVIOR: L.icon({ iconUrl: "/icons/person_alert.png", ...baseIconProps }),
            PARTICIPANT_HAZARD: L.icon({ iconUrl: "/icons/brightness_alert.png", ...baseIconProps }),
            WASTE_ILLEGAL_DUMPING: L.icon({ iconUrl: "/icons/delete_sweep.png", ...baseIconProps }),
            BIOLOGICAL_HAZARD: L.icon({ iconUrl: "/icons/bug_report.png", ...baseIconProps }),
            OTHER: L.icon({ iconUrl: "/icons/help_outline.png", ...baseIconProps })
        }
        const defaultIcon = categoryIcons["OTHER"]

        // Create popup content
        const createPopupContent = (report: Report): string => {
            const categoryKey = report.category
            const polishCategoryName = CATEGORY_DISPLAY_NAMES[categoryKey] || "Nieznana kategoria"

            let content = `
                <b>Kategoria: ${polishCategoryName}</b><br>
                <b>${report.title}</b><br>
                ${report.description || "Brak opisu."}
            `

            const imageIds = report.imageIds || []

            if (imageIds.length > 0) {
                let imageHtml = `<div class="report-image-container">`

                imageIds.forEach((imageId) => {
                    const thumbImageUrl = `${MEDIA_SERVICE_BASE_URL}${imageId}?variant=thumb`
                    const fullImageUrl = `${MEDIA_SERVICE_BASE_URL}${imageId}?variant=preview`

                    imageHtml += `
                        <img
                            src="${thumbImageUrl}"
                            class="report-image"
                            alt="Evidence image for ${report.title}"
                            title="Kliknij, aby zobaczyć pełne zdjęcie (ID: ${imageId})"
                            onclick="window.openLightbox('${fullImageUrl}')"
                            onerror="this.outerHTML='<span class=\\'image-placeholder\\'>Błąd Ładowania Obrazu</span>'"
                        />
                    `
                })

                imageHtml += `</div>`
                content += imageHtml
            }

            return content
        }

        // Add marker to map
        const addMarkerToMap = (report: Report) => {
            if (!report || !report.latitude || !report.longitude) {
                return
            }

            if (displayedReportIdsRef.current.has(report.id)) {
                return
            }

            const category = report.category
            const selectedIcon = categoryIcons[category] || defaultIcon

            displayedReportIdsRef.current.add(report.id)

            const popupContent = createPopupContent(report)

            const marker = L.marker([report.latitude, report.longitude], { icon: selectedIcon }).bindPopup(popupContent, {
                maxWidth: 400
            })

            // Add to cluster group
            markersRef.current?.addLayer(marker)
        }

        // Fetch reports
        const fetchReports = async () => {
            // If initial reports are provided (even if empty array), use them
            // Empty array means the server tried to fetch but there were no reports or backend was down
            if (initialReports !== undefined) {
                if (initialReports.length > 0) {
                    initialReports.forEach((report) => addMarkerToMap(report))
                }
                // Map will load without markers if array is empty - this is OK
                return
            }

            // Fallback fetch ONLY if initialReports was not provided at all
            try {
                // Fetch from our local API route (proxy)
                const response = await fetch("/api/reports")

                if (!response.ok) {
                    console.error(`Błąd serwera (${response.status})`)
                    return
                }

                const data = await response.json()

                if (Array.isArray(data)) {
                    data.forEach((report: Report) => {
                        addMarkerToMap(report)
                    })
                }
            } catch (error) {
                console.error("Błąd połączenia:", error)
            }
        }

        fetchReports()

        // Handle image clicks in popups
        type WindowWithLightbox = Window & { openLightbox?: (url: string) => void }
        const win = window as WindowWithLightbox
        win.openLightbox = (url: string) => {
            setLightboxImage(url)
        }

        // Cleanup
        return () => {
            delete win.openLightbox
            map.remove()
            mapRef.current = null
        }
    }, [initialReports])

    // Search for cities using Nominatim API
    const handleSearch = async (query: string) => {
        if (query.length < 2) {
            setSearchResults([])
            return
        }

        setIsSearching(true)
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                    `q=${encodeURIComponent(query)}&` +
                    `format=json&` +
                    `countrycodes=pl&` +
                    `limit=5&` +
                    `addressdetails=1`,
                {
                    headers: {
                        "User-Agent": "RiskRadar-Map-Application"
                    }
                }
            )
            const data: SearchResult[] = await response.json()
            setSearchResults(data)
            setShowResults(true)
        } catch (error) {
            console.error("Błąd wyszukiwania:", error)
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchQuery(value)

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // Debounce search
        searchTimeoutRef.current = setTimeout(() => {
            handleSearch(value)
        }, 300)
    }

    const handleSelectLocation = (result: SearchResult) => {
        const lat = parseFloat(result.lat)
        const lon = parseFloat(result.lon)

        if (mapRef.current) {
            mapRef.current.flyTo([lat, lon], 13, {
                duration: 1.5
            })
        }

        setSearchQuery(result.display_name)
        setShowResults(false)
    }

    const handleZoomIn = () => {
        mapRef.current?.zoomIn()
    }

    const handleZoomOut = () => {
        mapRef.current?.zoomOut()
    }

    const handleLocateMe = () => {
        if (!mapRef.current) return

        mapRef.current.locate({ setView: true, maxZoom: 18 })

        mapRef.current.on("locationerror", (e: L.ErrorEvent) => {
            alert("Nie można znaleźć Twojej lokalizacji: " + e.message)
        })
    }

    // AI Assistant - analyze nearby threats
    const handleAIAnalysis = async () => {
        if (aiLoading) return

        setAiLoading(true)
        setAiResponse(null)

        // First, get user's location
        if (!navigator.geolocation) {
            alert('Geolokalizacja nie jest wspierana przez Twoją przeglądarkę')
            setAiLoading(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude
                const lng = position.coords.longitude

                setUserLocation({ lat, lng })

                // Add user location marker to the map
                if (mapRef.current) {
                    // Remove previous user location marker and circle
                    if (userLocationMarkerRef.current) {
                        mapRef.current.removeLayer(userLocationMarkerRef.current)
                        userLocationMarkerRef.current = null
                    }
                    if (userLocationCircleRef.current) {
                        mapRef.current.removeLayer(userLocationCircleRef.current)
                        userLocationCircleRef.current = null
                    }

                    // Add circle showing 1km radius
                    const circle = L.circle([lat, lng], {
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.1,
                        radius: 1000, // 1km in meters
                        weight: 2,
                        dashArray: '5, 10'
                    }).addTo(mapRef.current)
                    userLocationCircleRef.current = circle

                    // Add user location marker (blue pulsing dot)
                    const marker = L.marker([lat, lng], {
                        icon: createUserLocationIcon(),
                        zIndexOffset: 1000 // Make sure it's on top
                    })
                        .addTo(mapRef.current)
                        .bindPopup(`
                            <div class="text-center">
                                <b>📍 Twoja lokalizacja</b><br>
                                <span class="text-xs text-gray-500">
                                    ${lat.toFixed(6)}, ${lng.toFixed(6)}
                                </span>
                            </div>
                        `)
                    userLocationMarkerRef.current = marker

                    // Center map on user location
                    mapRef.current.flyTo([lat, lng], 14, { duration: 1.5 })
                }

                try {
                    // Call AI Assistant API
                    const response = await fetch('/api/ai-assistant/nearby-threats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            latitude: lat,
                            longitude: lng,
                            radius_km: 1.0
                        })
                    })

                    if (!response.ok) {
                        throw new Error('AI analysis failed')
                    }

                    const data = await response.json()

                    setAiResponse({
                        visible: true,
                        dangerLevel: data.danger_level,
                        dangerScore: data.danger_score,
                        summary: data.ai_summary,
                        reportsCount: data.reports_count
                    })
                } catch (error) {
                    console.error('AI analysis error:', error)
                    setAiResponse({
                        visible: true,
                        dangerLevel: 'Błąd',
                        dangerScore: 0,
                        summary: 'Nie udało się pobrać analizy. Spróbuj ponownie później.',
                        reportsCount: 0
                    })
                } finally {
                    setAiLoading(false)
                }
            },
            (error) => {
                console.error('Geolocation error:', error)
                alert('Nie można pobrać Twojej lokalizacji: ' + error.message)
                setAiLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    // Get danger level color
    const getDangerColor = (level: string) => {
        switch (level) {
            case 'Bardzo niski': return 'bg-green-500'
            case 'Niski': return 'bg-green-400'
            case 'Umiarkowany': return 'bg-yellow-500'
            case 'Wysoki': return 'bg-orange-500'
            case 'Bardzo wysoki': return 'bg-red-500'
            default: return 'bg-gray-500'
        }
    }

    // Get danger level emoji
    const getDangerEmoji = (level: string) => {
        switch (level) {
            case 'Bardzo niski': return '🌟'
            case 'Niski': return '✅'
            case 'Umiarkowany': return '⚠️'
            case 'Wysoki': return '🔶'
            case 'Bardzo wysoki': return '🚨'
            default: return '❓'
        }
    }

    // Close AI response and remove only the circle (keep marker visible)
    const handleCloseAIResponse = () => {
        setAiResponse(null)

        // Remove only the circle from map, keep the marker
        if (mapRef.current) {
            if (userLocationCircleRef.current) {
                mapRef.current.removeLayer(userLocationCircleRef.current)
                userLocationCircleRef.current = null
            }
        }
    }

    // AI Assistant - analyze nearby threats
    const handleAIAnalysis = async () => {
        if (aiLoading) return

        setAiLoading(true)
        setAiResponse(null)

        // First, get user's location
        if (!navigator.geolocation) {
            alert('Geolokalizacja nie jest wspierana przez Twoją przeglądarkę')
            setAiLoading(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude
                const lng = position.coords.longitude

                setUserLocation({ lat, lng })

                // Add user location marker to the map
                if (mapRef.current) {
                    // Remove previous user location marker and circle
                    if (userLocationMarkerRef.current) {
                        mapRef.current.removeLayer(userLocationMarkerRef.current)
                        userLocationMarkerRef.current = null
                    }
                    if (userLocationCircleRef.current) {
                        mapRef.current.removeLayer(userLocationCircleRef.current)
                        userLocationCircleRef.current = null
                    }

                    // Add circle showing 1km radius
                    const circle = L.circle([lat, lng], {
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.1,
                        radius: 1000, // 1km in meters
                        weight: 2,
                        dashArray: '5, 10'
                    }).addTo(mapRef.current)
                    userLocationCircleRef.current = circle

                    // Add user location marker (blue pulsing dot)
                    const marker = L.marker([lat, lng], {
                        icon: createUserLocationIcon(),
                        zIndexOffset: 1000 // Make sure it's on top
                    })
                        .addTo(mapRef.current)
                        .bindPopup(`
                            <div class="text-center">
                                <b>📍 Twoja lokalizacja</b><br>
                                <span class="text-xs text-gray-500">
                                    ${lat.toFixed(6)}, ${lng.toFixed(6)}
                                </span>
                            </div>
                        `)
                    userLocationMarkerRef.current = marker

                    // Center map on user location
                    mapRef.current.flyTo([lat, lng], 14, { duration: 1.5 })
                }

                try {
                    // Call AI Assistant API
                    const response = await fetch('/api/ai-assistant/nearby-threats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            latitude: lat,
                            longitude: lng,
                            radius_km: 1.0
                        })
                    })

                    if (!response.ok) {
                        throw new Error('AI analysis failed')
                    }

                    const data = await response.json()

                    setAiResponse({
                        visible: true,
                        dangerLevel: data.danger_level,
                        dangerScore: data.danger_score,
                        summary: data.ai_summary,
                        reportsCount: data.reports_count
                    })
                } catch (error) {
                    console.error('AI analysis error:', error)
                    setAiResponse({
                        visible: true,
                        dangerLevel: 'Błąd',
                        dangerScore: 0,
                        summary: 'Nie udało się pobrać analizy. Spróbuj ponownie później.',
                        reportsCount: 0
                    })
                } finally {
                    setAiLoading(false)
                }
            },
            (error) => {
                console.error('Geolocation error:', error)
                alert('Nie można pobrać Twojej lokalizacji: ' + error.message)
                setAiLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    // Get danger level color
    const getDangerColor = (level: string) => {
        switch (level) {
            case 'Bardzo niski': return 'bg-green-500'
            case 'Niski': return 'bg-green-400'
            case 'Umiarkowany': return 'bg-yellow-500'
            case 'Wysoki': return 'bg-orange-500'
            case 'Bardzo wysoki': return 'bg-red-500'
            default: return 'bg-gray-500'
        }
    }

    // Get danger level emoji
    const getDangerEmoji = (level: string) => {
        switch (level) {
            case 'Bardzo niski': return '🌟'
            case 'Niski': return '✅'
            case 'Umiarkowany': return '⚠️'
            case 'Wysoki': return '🔶'
            case 'Bardzo wysoki': return '🚨'
            default: return '❓'
        }
    }

    // Close AI response and remove only the circle (keep marker visible)
    const handleCloseAIResponse = () => {
        setAiResponse(null)

        // Remove only the circle from map, keep the marker
        if (mapRef.current) {
            if (userLocationCircleRef.current) {
                mapRef.current.removeLayer(userLocationCircleRef.current)
                userLocationCircleRef.current = null
            }
        }
    }

    return (
        <>
            {/* Styles moved to globals.css */}

            <div className="relative flex h-full w-full flex-col overflow-hidden">
                {/* Sidebar */}
                <aside
                    className={`absolute inset-y-0 left-0 z-30 flex w-72 flex-col bg-[#362c20]/90 p-4 backdrop-blur-sm transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
                >
                    <div className="flex items-center justify-between px-3 py-2">
                        <Link href="/" className="flex items-center gap-3">
                            <div
                                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
                                style={{
                                    backgroundImage:
                                        'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBCpSftcBIvJAKvmwFok7b1n6PmpFeiao9KAOoqFs1ajLc3TP11U4nkdfvllw469DY1mB-Y1m1e7oB8GSX8bbwky-01VrnWL9l125eTlHbsCZUcZjvd7TiB8IW5deiSfMZwMmILFSm1c_nTv7Ci1kWaC8oKq2yPxg4R5NvJS4GZiUGdi1_IPO8Br02BiSIni02B55xHKLE6UZ8ijEO6waP2xaJfd7-QajaNPHqxIs-PfTZTFZp7RFc3jiA6t0XacRdEVHpJlzgLrz4")'
                                }}
                            />
                            <h1 className="text-[#e0dcd7] text-lg font-bold leading-normal">RiskRadar</h1>
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="flex size-10 items-center justify-center rounded-lg text-[#e0dcd7] hover:bg-white/10 transition-colors"
                            title="Schowaj sidebar"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                    </div>
                    <div className="flex flex-col gap-2 mt-8">
                        <Link
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#d97706] hover:bg-[#d97706]/80 text-white font-semibold transition-colors"
                            href="/submit-report"
                        >
                            <span className="material-symbols-outlined">add_location_alt</span>
                            <p className="text-base leading-normal">Zgłoś Nowe Zdarzenie</p>
                        </Link>

                        <div className="border-t border-[#e0dcd7]/10 my-2"></div>

                        <Link
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#e0dcd7] hover:bg-white/10 transition-colors"
                            href="/profile"
                        >
                            <span className="material-symbols-outlined">person</span>
                            <p className="text-base leading-normal">Profil</p>
                        </Link>
                        <Link
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#e0dcd7] hover:bg-white/10 transition-colors"
                            href="/my-reports"
                        >
                            <span className="material-symbols-outlined">description</span>
                            <p className="text-base leading-normal">Moje zgłoszenia</p>
                        </Link>
                        <Link
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#e0dcd7] hover:bg-white/10 transition-colors"
                            href="/settings"
                        >
                            <span className="material-symbols-outlined">settings</span>
                            <p className="text-base leading-normal">Ustawienia</p>
                        </Link>

                        {isAdmin && (
                            <>
                                <div className="border-t border-[#e0dcd7]/10 my-2"></div>

                                <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#e0dcd7] hover:bg-white/10 transition-colors"
                                    href="/admin">
                                    <span className="material-symbols-outlined">shield</span>
                                    <p className="text-base leading-normal">Panel administratora</p>
                                </a>
                            </>
                        )}
                    </div>
                </aside>

                {/* Main Content */}
                <main
                    className={`relative flex flex-1 flex-col transition-all duration-300 ${sidebarOpen ? "md:ml-72" : ""}`}
                >
                    {/* Hamburger Menu Button */}
                    {!sidebarOpen && (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="absolute top-4 left-4 z-40 flex size-12 items-center justify-center rounded-lg bg-[#362c20]/90 backdrop-blur-sm shadow-lg hover:bg-[#362c20] transition-colors"
                            title="Pokaż sidebar"
                        >
                            <span className="material-symbols-outlined text-[#e0dcd7] text-3xl">menu</span>
                        </button>
                    )}

                    {/* Search Bar */}
                    <div className="absolute inset-x-0 top-0 flex justify-center p-4 z-30">
                        <div className="flex flex-col w-full max-w-lg search-container">
                            <div
                                className={`flex w-full flex-1 items-stretch h-24 shadow-lg backdrop-blur-sm transition-all ${showResults || isSearching ? "rounded-t-xl" : "rounded-xl"}`}
                            >
                                <div
                                    className={`text-[#e0dcd7]/70 flex bg-[#362c20]/90 items-center justify-center px-5 backdrop-blur-sm ${showResults || isSearching ? "rounded-tl-xl" : "rounded-l-xl"}`}
                                >
                                    <span className="material-symbols-outlined text-4xl">search</span>
                                </div>
                                <input
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                                    className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden text-[#e0dcd7] focus:outline-0 border-none bg-[#362c20]/90 backdrop-blur-sm h-full placeholder:text-[#e0dcd7]/70 px-6 text-2xl font-normal leading-normal ${showResults || isSearching ? "rounded-tr-xl" : "rounded-r-xl"}`}
                                    placeholder="Wyszukaj miasto w Polsce..."
                                />
                            </div>

                            {/* Search Results Dropdown */}
                            {showResults && searchResults.length > 0 && (
                                <div className="w-full bg-[#362c20]/90 backdrop-blur-sm rounded-b-xl shadow-lg max-h-80 overflow-y-auto">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.place_id}
                                            onClick={() => handleSelectLocation(result)}
                                            className="w-full text-left px-5 py-4 hover:bg-[#d97706]/20 transition-colors border-b border-[#e0dcd7]/10 last:border-b-0 first:pt-5"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-[#d97706] text-2xl">
                                                    location_on
                                                </span>
                                                <span className="text-[#e0dcd7] text-base">{result.display_name}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Loading indicator */}
                            {isSearching && (
                                <div className="w-full bg-[#362c20]/90 backdrop-blur-sm rounded-b-xl shadow-lg px-5 py-5">
                                    <div className="flex items-center gap-2 text-[#e0dcd7]">
                                        <span className="text-sm">Wyszukiwanie...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Map Container */}
                    <div className="absolute inset-0">
                        <div ref={mapContainerRef} className="h-full w-full z-[1]" />
                    </div>

                    {/* AI Assistant Button - Left Bottom Corner */}
                    <div className="absolute bottom-6 left-6 z-20">
                        <button
                            onClick={handleAIAnalysis}
                            disabled={aiLoading}
                            className={`
                                flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg
                                ${aiLoading 
                                    ? 'bg-[#d97706]/70 cursor-wait' 
                                    : 'bg-gradient-to-r from-[#d97706] to-[#ea580c] hover:from-[#ea580c] hover:to-[#dc2626]'
                                }
                                text-white font-semibold transition-all duration-300
                                hover:scale-105 hover:shadow-xl
                            `}
                            title="Sprawdź bezpieczeństwo okolicy z AI"
                        >
                            {aiLoading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                    <span>Analizuję...</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-xl">✨</span>
                                    <span>AI Asystent</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* AI Response Bubble */}
                    {aiResponse?.visible && (
                        <div className="absolute bottom-24 left-6 z-30 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
                                {/* Header with danger level */}
                                <div className={`${getDangerColor(aiResponse.dangerLevel)} px-4 py-3 flex items-center justify-between`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{getDangerEmoji(aiResponse.dangerLevel)}</span>
                                        <div>
                                            <p className="text-white font-bold text-sm">Analiza bezpieczeństwa</p>
                                            <p className="text-white/90 text-xs">
                                                {aiResponse.reportsCount} zgłoszeń w promieniu 1km
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCloseAIResponse}
                                        className="text-white/80 hover:text-white transition-colors"
                                        title="Zamknij"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                {/* Danger Score Badge */}
                                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between border-b border-gray-100">
                                    <span className="text-gray-600 text-sm font-medium">Poziom zagrożenia:</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`
                                            px-3 py-1 rounded-full text-sm font-bold text-white
                                            ${getDangerColor(aiResponse.dangerLevel)}
                                        `}>
                                            {aiResponse.dangerLevel}
                                        </span>
                                        <span className="text-gray-500 text-xs">
                                            ({Math.round(aiResponse.dangerScore)}/100)
                                        </span>
                                    </div>
                                </div>

                                {/* AI Summary */}
                                <div className="px-4 py-4">
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                        {aiResponse.summary}
                                    </p>
                                </div>

                                {/* Footer */}
                                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
                                    <span className="text-xs">🤖</span>
                                    <span className="text-gray-400 text-xs">
                                        Analiza wygenerowana przez AI • RiskRadar
                                    </span>
                                </div>
                            </div>

                            {/* Speech bubble arrow */}
                            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-white border-r border-b border-gray-200 transform rotate-45"></div>
                        </div>
                    )}

                    {/* Map Controls */}
                    <div className="absolute bottom-6 right-6 flex items-end justify-end gap-3 z-20">
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex flex-col gap-0.5 shadow-lg">
                                <button
                                    onClick={handleZoomIn}
                                    className="flex size-10 items-center justify-center rounded-t-lg bg-[#362c20] hover:bg-[#362c20]/80 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[#e0dcd7]">add</span>
                                </button>
                                <button
                                    onClick={handleZoomOut}
                                    className="flex size-10 items-center justify-center rounded-b-lg bg-[#362c20] hover:bg-[#362c20]/80 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[#e0dcd7]">remove</span>
                                </button>
                            </div>
                            <button
                                onClick={handleLocateMe}
                                className="flex size-10 items-center justify-center rounded-lg bg-[#362c20] shadow-lg hover:bg-[#362c20]/80 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[#e0dcd7]">my_location</span>
                            </button>
                        </div>
                    </div>
                </main>
            </div>

            {/* Lightbox for images */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[9999] flex justify-center items-center bg-black/80"
                    onClick={() => setLightboxImage(null)}
                >
                    <div
                        className="relative bg-white p-2 rounded-lg flex justify-center items-center shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span
                            className="absolute -top-4 -right-4 flex w-10 h-10 items-center justify-center rounded-full bg-white text-black border-2 border-gray-300 cursor-pointer hover:bg-gray-100 shadow-lg z-[10000]"
                            onClick={() => setLightboxImage(null)}
                            title="Zamknij"
                        >
                            <span className="text-xl font-bold">✕</span>
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={lightboxImage}
                            alt="Pełnowymiarowe zdjęcie"
                            className="max-w-[90vw] max-h-[90vh] object-contain rounded-[4px]"
                        />
                    </div>
                </div>
            )}
        </>
    )
}
