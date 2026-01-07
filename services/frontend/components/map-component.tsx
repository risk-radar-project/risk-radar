"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"
import "leaflet.markercluster"

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
    address?: {
        road?: string
        house_number?: string
        city?: string
        town?: string
        village?: string
        municipality?: string
    }
}

interface MapComponentProps {
    initialReports?: Report[]
    initialLat?: number
    initialLng?: number
    initialZoom?: number
}

export default function MapComponent({ 
    initialReports = [], 
    initialLat, 
    initialLng, 
    initialZoom 
}: MapComponentProps) {
    const mapRef = useRef<L.Map | null>(null)
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const markersRef = useRef<L.MarkerClusterGroup | null>(null)
    const displayedReportIdsRef = useRef<Set<string>>(new Set())
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const userLocationMarkerRef = useRef<L.Marker | null>(null)
    const userLocationCircleRef = useRef<L.Circle | null>(null)

    const [lightboxImage, setLightboxImage] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [showResults, setShowResults] = useState(false)
    const [isSearching, setIsSearching] = useState(false)

    // AI Assistant state
    const [aiLoading, setAiLoading] = useState(false)
    const [aiResponse, setAiResponse] = useState<{
        visible: boolean
        dangerLevel: string
        dangerScore: number
        summary: string
        reportsCount: number
    } | null>(null)
    // AI Area Selection Mode
    const [aiSelectMode, setAiSelectMode] = useState(false)
    const [selectedAreaLocation, setSelectedAreaLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    // AI Menu expanded state
    const [aiMenuOpen, setAiMenuOpen] = useState(false)
    const selectedAreaMarkerRef = useRef<L.Marker | null>(null)
    const selectedAreaCircleRef = useRef<L.Circle | null>(null)

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

        // Determine start view
        const startLat = initialLat || 50.06
        const startLng = initialLng || 19.94
        // If query params are provided, zoom in closer (e.g. 16), otherwise default to 9
        const startZoom = initialZoom || (initialLat && initialLng ? 16 : 9)

        // Initialize map centered on Kraków (where reports are located) or specific point
        const map = L.map(mapContainerRef.current, {
            attributionControl: false,
            zoomControl: false
        }).setView([startLat, startLng], startZoom)
        mapRef.current = map

        // FIX: Clear the "displayed" set when the map is re-initialized.
        // This prevents the bug where HMR/Strict Mode re-creates the map,
        // but the Ref still thinks markers are already added.
        displayedReportIdsRef.current.clear()

        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            maxZoom: 19
        }).addTo(map)

        // Track if map is destroyed to prevent calls on unmounted map
        let isDestroyed = false

        // Fix map rendering issues - invalidate size after initialization
        setTimeout(() => {
            if (!isDestroyed) map.invalidateSize()
        }, 100)

        // Additional invalidation after tiles load
        map.whenReady(() => {
            setTimeout(() => {
                if (!isDestroyed) map.invalidateSize()
            }, 200)
        })

        // Listen for tile loading to ensure proper rendering
        map.on("load", () => {
            if (!isDestroyed) map.invalidateSize()
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
            isDestroyed = true
            delete win.openLightbox
            map.remove()
            mapRef.current = null
        }
    }, [initialReports])

    // Format address to show only essential parts
    const formatAddress = (result: SearchResult): string => {
        if (!result.address) {
            // Fallback to first 2-3 parts of display_name
            const parts = result.display_name.split(', ')
            return parts.slice(0, 3).join(', ')
        }

        const parts: string[] = []
        
        // Add street and number
        if (result.address.road) {
            let street = result.address.road
            if (result.address.house_number) {
                street += ' ' + result.address.house_number
            }
            parts.push(street)
        }
        
        // Add city/town/village
        const location = result.address.city || result.address.town || result.address.village || result.address.municipality
        if (location) {
            parts.push(location)
        }
        
        return parts.length > 0 ? parts.join(', ') : result.display_name.split(', ').slice(0, 2).join(', ')
    }

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
        
        // Show results panel when typing
        if (value.length >= 2) {
            setShowResults(true)
            setIsSearching(true) // Set searching immediately to show loading state
        } else {
            setShowResults(false)
            setSearchResults([])
        }

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

        setSearchQuery(formatAddress(result))
        setShowResults(false)
    }
    const handleClearSearch = () => {
        setSearchQuery("")
        setSearchResults([])
        setShowResults(false)
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }
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

    // Get location with fallback to IP geolocation (for Windows and other devices)
    const getLocationWithFallback = async (): Promise<{ lat: number; lng: number } | null> => {
        // Try browser geolocation first
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                // No geolocation support - try IP fallback
                getLocationFromIP().then(resolve)
                return
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    })
                },
                async (error) => {
                    console.warn("Geolocation failed, trying IP fallback:", error.message)
                    // Fallback to IP geolocation
                    const ipLocation = await getLocationFromIP()
                    resolve(ipLocation)
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            )
        })
    }

    // IP-based geolocation fallback (works on Windows without HTTPS)
    const getLocationFromIP = async (): Promise<{ lat: number; lng: number } | null> => {
        try {
            // Using ip-api.com (free, no API key needed)
            const response = await fetch("http://ip-api.com/json/?fields=lat,lon,status")
            const data = await response.json()
            if (data.status === "success" && data.lat && data.lon) {
                return { lat: data.lat, lng: data.lon }
            }
        } catch (e) {
            console.error("IP geolocation failed:", e)
        }
        
        try {
            // Backup: ipapi.co
            const response = await fetch("https://ipapi.co/json/")
            const data = await response.json()
            if (data.latitude && data.longitude) {
                return { lat: data.latitude, lng: data.longitude }
            }
        } catch (e) {
            console.error("Backup IP geolocation failed:", e)
        }
        
        return null
    }

    // Perform AI analysis at given coordinates
    const performAIAnalysis = async (lat: number, lng: number, isUserLocation: boolean = false) => {
        // Add marker and circle to map
        if (mapRef.current) {
            // Remove previous markers/circles
            if (userLocationMarkerRef.current) {
                mapRef.current.removeLayer(userLocationMarkerRef.current)
                userLocationMarkerRef.current = null
            }
            if (userLocationCircleRef.current) {
                mapRef.current.removeLayer(userLocationCircleRef.current)
                userLocationCircleRef.current = null
            }
            if (selectedAreaMarkerRef.current) {
                mapRef.current.removeLayer(selectedAreaMarkerRef.current)
                selectedAreaMarkerRef.current = null
            }
            if (selectedAreaCircleRef.current) {
                mapRef.current.removeLayer(selectedAreaCircleRef.current)
                selectedAreaCircleRef.current = null
            }

            // Add circle showing 1km radius
            const circleColor = isUserLocation ? "#3b82f6" : "#d97706"
            const circle = L.circle([lat, lng], {
                color: circleColor,
                fillColor: circleColor,
                fillOpacity: 0.1,
                radius: 1000,
                weight: 2,
                dashArray: "5, 10"
            }).addTo(mapRef.current)

            if (isUserLocation) {
                userLocationCircleRef.current = circle
                // Add user location marker (blue pulsing dot)
                const marker = L.marker([lat, lng], {
                    icon: createUserLocationIcon(),
                    zIndexOffset: 1000
                }).addTo(mapRef.current).bindPopup(`
                    <div class="text-center">
                        <b>📍 Twoja lokalizacja</b><br>
                        <span class="text-xs text-gray-500">
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </span>
                    </div>
                `)
                userLocationMarkerRef.current = marker
            } else {
                selectedAreaCircleRef.current = circle
                // Add selected area marker (orange pin)
                const selectedIcon = L.divIcon({
                    className: "selected-area-marker",
                    html: `
                        <div style="
                            width: 36px;
                            height: 36px;
                            background: linear-gradient(135deg, #d97706, #ea580c);
                            border-radius: 50% 50% 50% 0;
                            transform: rotate(-45deg);
                            border: 3px solid white;
                            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <span style="transform: rotate(45deg); font-size: 16px;">🎯</span>
                        </div>
                    `,
                    iconSize: [36, 36],
                    iconAnchor: [18, 36],
                    popupAnchor: [0, -36]
                })
                const marker = L.marker([lat, lng], {
                    icon: selectedIcon,
                    zIndexOffset: 1000
                }).addTo(mapRef.current).bindPopup(`
                    <div class="text-center">
                        <b>🎯 Wybrany obszar</b><br>
                        <span class="text-xs text-gray-500">
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </span>
                    </div>
                `)
                selectedAreaMarkerRef.current = marker
            }

            // Center map on location
            mapRef.current.flyTo([lat, lng], 14, { duration: 1.5 })
        }

        try {
            // Call AI Assistant API
            const response = await fetch("/api/ai-assistant/nearby-threats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    latitude: lat,
                    longitude: lng,
                    radius_km: 1.0
                })
            })

            if (!response.ok) {
                throw new Error("AI analysis failed")
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
            console.error("AI analysis error:", error)
            setAiResponse({
                visible: true,
                dangerLevel: "Błąd",
                dangerScore: 0,
                summary: "Nie udało się pobrać analizy. Spróbuj ponownie później.",
                reportsCount: 0
            })
        } finally {
            setAiLoading(false)
            setAiSelectMode(false)
        }
    }

    // AI Assistant - analyze nearby threats at user location
    const handleAIAnalysisMyLocation = async () => {
        if (aiLoading) return

        setAiLoading(true)
        setAiResponse(null)
        setAiSelectMode(false)

        const location = await getLocationWithFallback()
        
        if (!location) {
            alert("Nie można pobrać Twojej lokalizacji. Użyj opcji 'Wybierz na mapie' aby ręcznie wskazać obszar.")
            setAiLoading(false)
            return
        }

        setUserLocation(location)
        await performAIAnalysis(location.lat, location.lng, true)
    }

    // AI Assistant - enable map click mode to select area
    const handleAISelectArea = () => {
        if (aiLoading) return
        setAiSelectMode(true)
        setAiResponse(null)
    }

    // Handle map click for area selection
    useEffect(() => {
        if (!mapRef.current) return

        const handleMapClick = async (e: L.LeafletMouseEvent) => {
            if (!aiSelectMode) return

            const { lat, lng } = e.latlng
            setSelectedAreaLocation({ lat, lng })
            setAiLoading(true)
            await performAIAnalysis(lat, lng, false)
        }

        if (aiSelectMode) {
            mapRef.current.on("click", handleMapClick)
            // Change cursor to crosshair
            mapRef.current.getContainer().style.cursor = "crosshair"
        } else {
            mapRef.current.off("click", handleMapClick)
            mapRef.current.getContainer().style.cursor = ""
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.off("click", handleMapClick)
                mapRef.current.getContainer().style.cursor = ""
            }
        }
    }, [aiSelectMode])

    // Cancel area selection mode
    const handleCancelSelectMode = () => {
        setAiSelectMode(false)
    }

    // Get danger level color
    const getDangerColor = (level: string) => {
        switch (level) {
            case "Bardzo niski":
                return "bg-green-500"
            case "Niski":
                return "bg-green-400"
            case "Umiarkowany":
                return "bg-yellow-500"
            case "Wysoki":
                return "bg-orange-500"
            case "Bardzo wysoki":
                return "bg-red-500"
            default:
                return "bg-gray-500"
        }
    }

    // Get danger level emoji
    const getDangerEmoji = (level: string) => {
        switch (level) {
            case "Bardzo niski":
                return "🌟"
            case "Niski":
                return "✅"
            case "Umiarkowany":
                return "⚠️"
            case "Wysoki":
                return "🔶"
            case "Bardzo wysoki":
                return "🚨"
            default:
                return "❓"
        }
    }

    // Close AI response and remove circles
    const handleCloseAIResponse = () => {
        setAiResponse(null)
        setAiSelectMode(false)
        setAiMenuOpen(false)

        // Remove circles from map (keep markers visible)
        if (mapRef.current) {
            if (userLocationCircleRef.current) {
                mapRef.current.removeLayer(userLocationCircleRef.current)
                userLocationCircleRef.current = null
            }
            if (selectedAreaCircleRef.current) {
                mapRef.current.removeLayer(selectedAreaCircleRef.current)
                selectedAreaCircleRef.current = null
            }
        }
    }

    // Close AI menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (aiMenuOpen && !target.closest(".ai-assistant-container")) {
                setAiMenuOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [aiMenuOpen])

    return (
        <>
            {/* Styles moved to globals.css */}

            <div className="relative flex h-full w-full flex-col overflow-hidden">
                {/* Main Content */}
                <main className={`relative flex flex-1 flex-col transition-all duration-300`}>
                    {/* Search Bar */}
                    <div className="absolute inset-x-0 top-0 z-30 flex justify-center p-4">
                        <div className="search-container flex w-full max-w-lg flex-col">
                            <div
                                className={`flex h-24 w-full flex-1 items-stretch shadow-lg backdrop-blur-sm transition-all ${showResults || isSearching ? "rounded-t-xl" : "rounded-xl"}`}
                            >
                                <div
                                    className={`flex items-center justify-center bg-[#362c20]/90 px-5 text-[#e0dcd7]/70 backdrop-blur-sm ${showResults || isSearching ? "rounded-tl-xl" : "rounded-l-xl"}`}
                                >
                                    <span className="material-symbols-outlined text-4xl">search</span>
                                </div>
                                <div className="relative flex h-full w-full flex-1">
                                    <input
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onFocus={() => searchResults.length > 0 && setShowResults(true)}
                                        className={`form-input flex h-full w-full min-w-0 flex-1 resize-none overflow-hidden border-none bg-[#362c20]/90 px-8 py-4 text-lg leading-normal font-normal text-[#e0dcd7] backdrop-blur-sm placeholder:text-[#e0dcd7]/70 focus:outline-0 ${showResults || isSearching ? "rounded-tr-xl" : "rounded-r-xl"}`}
                                        placeholder="Wyszukaj lokalizację..."
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={handleClearSearch}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#e0dcd7]/70 transition-colors hover:text-[#e0dcd7]"
                                            title="Wyczyść"
                                        >
                                            <span className="material-symbols-outlined text-2xl">close</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Search Results Dropdown */}
                            {showResults && searchResults.length > 0 && (
                                <div className="max-h-80 w-full overflow-y-auto rounded-b-xl bg-[#362c20]/90 shadow-lg backdrop-blur-sm">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.place_id}
                                            onClick={() => handleSelectLocation(result)}
                                            className="w-full border-b border-[#e0dcd7]/10 px-5 py-4 text-left transition-colors first:pt-5 last:border-b-0 hover:bg-[#d97706]/20"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-2xl text-[#d97706]">
                                                    location_on
                                                </span>
                                                <span className="text-base text-[#e0dcd7]">{formatAddress(result)}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Loading indicator */}
                            {isSearching && (
                                <div className="w-full rounded-b-xl bg-[#362c20]/90 px-5 py-5 shadow-lg backdrop-blur-sm">
                                    <div className="flex items-center gap-2 text-[#e0dcd7]">
                                        <span className="text-sm">Wyszukiwanie...</span>
                                    </div>
                                </div>
                            )}

                            {/* No results message */}
                            {!isSearching && showResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                                <div className="w-full rounded-b-xl bg-[#362c20]/90 px-5 py-5 shadow-lg backdrop-blur-sm">
                                    <div className="flex items-center gap-2 text-[#e0dcd7]/70">
                                        <span className="material-symbols-outlined text-xl">search_off</span>
                                        <span className="text-sm">Nie znaleziono wyników</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Map Container */}
                    <div className="absolute inset-0">
                        <div ref={mapContainerRef} className="z-[1] h-full w-full" />
                    </div>

                    {/* AI Assistant Buttons - Left Bottom Corner */}
                    <div className="ai-assistant-container absolute bottom-6 left-6 z-20 flex flex-col items-start gap-2">
                        {/* Area Selection Mode Active Banner */}
                        {aiSelectMode && (
                            <div className="animate-in fade-in mb-2 flex items-center gap-2 rounded-xl bg-[#362c20]/95 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
                                <span className="text-xl">🎯</span>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">Tryb wyboru obszaru</p>
                                    <p className="text-xs text-white/70">Kliknij na mapę, aby wybrać punkt do analizy</p>
                                </div>
                                <button
                                    onClick={() => { handleCancelSelectMode(); setAiMenuOpen(false); }}
                                    className="rounded-lg bg-white/10 p-1.5 transition-colors hover:bg-white/20"
                                    title="Anuluj"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        )}

                        {/* AI Menu Options - shown when menu is open */}
                        {aiMenuOpen && !aiSelectMode && !aiLoading && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 mb-2 flex flex-col gap-2 duration-200">
                                {/* Option 1: My Location */}
                                <button
                                    onClick={() => { handleAIAnalysisMyLocation(); setAiMenuOpen(false); }}
                                    className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] px-4 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-[#2563eb] hover:to-[#1d4ed8] hover:shadow-xl"
                                    title="Analizuj bezpieczeństwo w mojej lokalizacji"
                                >
                                    <span className="material-symbols-outlined">my_location</span>
                                    <span>Moja lokalizacja</span>
                                </button>

                                {/* Option 2: Select on map */}
                                <button
                                    onClick={() => { handleAISelectArea(); setAiMenuOpen(false); }}
                                    className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#d97706] to-[#ea580c] px-4 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-[#ea580c] hover:to-[#dc2626] hover:shadow-xl"
                                    title="Wybierz obszar na mapie do analizy"
                                >
                                    <span className="text-xl">🎯</span>
                                    <span>Wybierz na mapie</span>
                                </button>
                            </div>
                        )}

                        {/* Main AI Assistant Button */}
                        <button
                            onClick={() => setAiMenuOpen(!aiMenuOpen)}
                            disabled={aiLoading || aiSelectMode}
                            className={`flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg ${
                                aiLoading
                                    ? "cursor-wait bg-[#8b5cf6]/70"
                                    : aiSelectMode
                                      ? "cursor-not-allowed bg-gray-400"
                                      : aiMenuOpen
                                        ? "bg-[#7c3aed] ring-2 ring-white"
                                        : "bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6d28d9]"
                            } font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-xl`}
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
                                    <span className="material-symbols-outlined text-lg">
                                        {aiMenuOpen ? "expand_more" : "expand_less"}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* AI Response Bubble */}
                    {aiResponse?.visible && (
                        <div className="animate-in fade-in slide-in-from-top-4 absolute right-6 top-24 z-30 max-w-sm duration-300">
                            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                                {/* Header with danger level */}
                                <div
                                    className={`${getDangerColor(aiResponse.dangerLevel)} flex items-center justify-between px-4 py-3`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{getDangerEmoji(aiResponse.dangerLevel)}</span>
                                        <div>
                                            <p className="text-sm font-bold text-white">Analiza bezpieczeństwa</p>
                                            <p className="text-xs text-white/90">
                                                {aiResponse.reportsCount} zgłoszeń w promieniu 1km
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCloseAIResponse}
                                        className="text-white/80 transition-colors hover:text-white"
                                        title="Zamknij"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                {/* Danger Score Badge */}
                                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
                                    <span className="text-sm font-medium text-gray-600">Poziom zagrożenia:</span>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`rounded-full px-3 py-1 text-sm font-bold text-white ${getDangerColor(aiResponse.dangerLevel)} `}
                                        >
                                            {aiResponse.dangerLevel}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            ({Math.round(aiResponse.dangerScore)}/100)
                                        </span>
                                    </div>
                                </div>

                                {/* AI Summary */}
                                <div className="px-4 py-4">
                                    <p className="text-sm leading-relaxed text-gray-700">{aiResponse.summary}</p>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2">
                                    <span className="text-xs">🤖</span>
                                    <span className="text-xs text-gray-400">Analiza wygenerowana przez AI • RiskRadar</span>
                                </div>
                            </div>

                            {/* Speech bubble arrow pointing up */}
                            <div className="absolute -top-2 right-8 h-4 w-4 rotate-45 transform border-l border-t border-gray-200 bg-white"></div>
                        </div>
                    )}

                    {/* Map Controls */}
                    <div className="absolute right-6 bottom-6 z-20 flex items-end justify-end gap-3">
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex flex-col gap-0.5 shadow-lg">
                                <button
                                    onClick={handleZoomIn}
                                    className="flex size-10 items-center justify-center rounded-t-lg bg-[#362c20] transition-colors hover:bg-[#362c20]/80"
                                >
                                    <span className="material-symbols-outlined text-[#e0dcd7]">add</span>
                                </button>
                                <button
                                    onClick={handleZoomOut}
                                    className="flex size-10 items-center justify-center rounded-b-lg bg-[#362c20] transition-colors hover:bg-[#362c20]/80"
                                >
                                    <span className="material-symbols-outlined text-[#e0dcd7]">remove</span>
                                </button>
                            </div>
                            <button
                                onClick={handleLocateMe}
                                className="flex size-10 items-center justify-center rounded-lg bg-[#362c20] shadow-lg transition-colors hover:bg-[#362c20]/80"
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
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
                    onClick={() => setLightboxImage(null)}
                >
                    <div
                        className="relative flex items-center justify-center rounded-lg bg-white p-2 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span
                            className="absolute -top-4 -right-4 z-[10000] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-gray-300 bg-white text-black shadow-lg hover:bg-gray-100"
                            onClick={() => setLightboxImage(null)}
                            title="Zamknij"
                        >
                            <span className="text-xl font-bold">✕</span>
                        </span>
                        {}
                        <img
                            src={lightboxImage}
                            alt="Pełnowymiarowe zdjęcie"
                            className="max-h-[90vh] max-w-[90vw] rounded-[4px] object-contain"
                        />
                    </div>
                </div>
            )}
        </>
    )
}
