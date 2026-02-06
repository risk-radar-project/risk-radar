"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"
import "leaflet.markercluster"
import { useAuth } from "@/hooks/use-auth"
import { getFreshAccessToken } from "@/lib/auth/auth-service"

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

export default function MapComponent({ initialReports = [], initialLat, initialLng, initialZoom }: MapComponentProps) {
    const { isAuthenticated } = useAuth()
    const mapRef = useRef<L.Map | null>(null)
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const markersRef = useRef<L.MarkerClusterGroup | null>(null)
    const displayedReportIdsRef = useRef<Set<string>>(new Set())
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const userLocationMarkerRef = useRef<L.Marker | null>(null)
    const userLocationCircleRef = useRef<L.Circle | null>(null)
    const addressCacheRef = useRef<Map<string, string>>(new Map())

    const [lightboxImage, setLightboxImage] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [showResults, setShowResults] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [searchFocused, setSearchFocused] = useState(false)

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
    // AI Menu expanded state
    const [aiMenuOpen, setAiMenuOpen] = useState(false)
    const selectedAreaMarkerRef = useRef<L.Marker | null>(null)
    const selectedAreaCircleRef = useRef<L.Circle | null>(null)
    const [isRefreshingReports, setIsRefreshingReports] = useState(false)
    const fetchReportsRef = useRef<(() => Promise<void> | void) | null>(null)

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
        const startZoom = initialZoom || (initialLat && initialLng ? 16 : 13)

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

        const formatReverseAddress = (
            address?: Partial<{
                road: string
                house_number: string
                city: string
                town: string
                village: string
                municipality: string
                neighbourhood: string
            }>
        ) => {
            if (!address) return null

            const street = address.road
                ? [address.road, address.house_number].filter(Boolean).join(" ").trim()
                : address.house_number || null

            const locality = address.city || address.town || address.village || address.municipality || address.neighbourhood

            const parts = [street, locality].filter(Boolean)
            return parts.length > 0 ? parts.join(", ") : null
        }

        const fetchApproxAddress = async (report: Report) => {
            const cacheKey = report.id
            const cached = addressCacheRef.current.get(cacheKey)
            if (cached) return cached

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${report.latitude}&lon=${report.longitude}&zoom=18&addressdetails=1`,
                    {
                        headers: {
                            "User-Agent": "RiskRadar-Map-Frontend",
                            "Accept-Language": "pl"
                        }
                    }
                )

                if (!response.ok) return null

                const data = await response.json()
                const formatted = formatReverseAddress(data.address) || data.display_name?.split(", ").slice(0, 2).join(", ")

                if (formatted) {
                    addressCacheRef.current.set(cacheKey, formatted)
                }

                return formatted || null
            } catch (error) {
                console.error("Reverse geocoding error:", error)
                return null
            }
        }

        // Create popup content with XSS protection
        const createPopupContent = (report: Report): HTMLElement => {
            const container = document.createElement("div")
            // Container doesn't need extra padding as internal elements handle it

            // --- HEADER ---
            const header = document.createElement("div")
            header.className = "popup-header"

            const titleElement = document.createElement("span")
            titleElement.style.fontWeight = "600"
            titleElement.style.color = "#f4f4f5" // zinc-100
            titleElement.textContent = report.title
            header.appendChild(titleElement)

            container.appendChild(header)

            // --- BODY ---
            const body = document.createElement("div")
            body.className = "popup-body"

            // Category Badge
            const categoryKey = report.category
            const polishCategoryName = CATEGORY_DISPLAY_NAMES[categoryKey] || "Nieznana kategoria"

            const badge = document.createElement("div")
            badge.className = "popup-badge"
            badge.textContent = polishCategoryName
            badge.style.marginBottom = "12px"
            body.appendChild(badge)

            // Description
            const description = document.createElement("p")
            description.textContent = report.description || "Brak opisu."
            description.style.fontSize = "0.875rem" // text-sm
            description.style.color = "#d4d4d8" // zinc-300
            description.style.margin = "0 0 12px 0"
            description.style.lineHeight = "1.4"
            body.appendChild(description)

            // Images
            const imageIds = report.imageIds || []
            if (imageIds.length > 0) {
                const imageContainer = document.createElement("div")
                imageContainer.className = "report-image-container"
                imageContainer.style.display = "grid"
                // Dynamic columns based on image count for better layout
                const columns = imageIds.length === 1 ? 1 : imageIds.length === 2 ? 2 : 3
                imageContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`
                imageContainer.style.gap = "8px"
                imageContainer.style.marginTop = "12px"
                imageContainer.style.maxWidth = "100%"

                imageIds.forEach((imageId) => {
                    const thumbImageUrl = `${MEDIA_SERVICE_BASE_URL}${imageId}?variant=thumb`
                    const fullImageUrl = `${MEDIA_SERVICE_BASE_URL}${imageId}?variant=preview`

                    const img = document.createElement("img")
                    img.src = thumbImageUrl
                    img.className = "report-image"
                    img.alt = `Zdjęcie zgłoszenia`
                    img.title = "Kliknij, aby powiększyć"
                    img.style.width = "100%"
                    img.style.aspectRatio = "1"
                    img.style.objectFit = "cover"
                    img.style.borderRadius = "4px"
                    img.style.cursor = "zoom-in"
                    img.style.border = "1px solid #3f3f46" // zinc-700
                    img.style.transition = "opacity 0.2s"

                    // Safe event handler using addEventListener
                    img.addEventListener("click", () => {
                        if (typeof window !== "undefined") {
                            setLightboxImage(fullImageUrl)
                        }
                    })

                    img.addEventListener("mouseenter", () => {
                        img.style.opacity = "0.8"
                    })
                    img.addEventListener("mouseleave", () => {
                        img.style.opacity = "1"
                    })

                    // Safe error handling
                    img.addEventListener("error", () => {
                        console.error(`Failed to load image: ${thumbImageUrl}`)
                        // Keep visible but maybe show error border
                        img.style.border = "2px solid red"
                        // img.style.display = "none" // Don't hide completely so we know it's there
                    })

                    imageContainer.appendChild(img)
                })

                body.appendChild(imageContainer)
            }

            container.appendChild(body)

            // --- FOOTER ---
            const footer = document.createElement("div")
            footer.className = "popup-footer"

            const footerText = document.createElement("span")
            footerText.textContent = "Risk Radar"
            footer.appendChild(footerText)

            const footerCoords = document.createElement("span")
            footerCoords.textContent = `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`
            footerCoords.className = "popup-location"
            footerCoords.style.fontFamily = "monospace"
            footerCoords.style.opacity = "0.7"
            footer.appendChild(footerCoords)

            container.appendChild(footer)

            return container
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

            const marker = L.marker([report.latitude, report.longitude], { icon: selectedIcon }).bindPopup(
                L.popup({ maxWidth: 400 }).setContent(popupContent)
            )

            marker.on("popupopen", async () => {
                const target = popupContent.querySelector<HTMLElement>(".popup-location")
                if (!target) return

                const cached = addressCacheRef.current.get(report.id)
                if (cached) {
                    target.textContent = cached
                    target.style.fontFamily = "inherit"
                    target.style.opacity = "0.9"
                    return
                }

                target.textContent = `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`

                const resolved = await fetchApproxAddress(report)
                if (resolved && target.isConnected) {
                    target.textContent = resolved
                    target.style.fontFamily = "inherit"
                    target.style.opacity = "0.9"
                }
            })

            // Add to cluster group
            markersRef.current?.addLayer(marker)
        }

        // Fetch reports (force = true bypasses static initial data)
        const fetchReports = async (force = false) => {
            if (force) {
                setIsRefreshingReports(true)
            }

            try {
                // When initialReports provided, we use them on first load unless force-refresh is requested
                if (!force && initialReports !== undefined) {
                    if (initialReports.length > 0) {
                        initialReports.forEach((report) => addMarkerToMap(report))
                    }
                    return
                }

                const response = await fetch("/api/reports")

                if (!response.ok) {
                    console.error(`Błąd serwera (${response.status})`)
                    return
                }

                const data = await response.json()

                if (Array.isArray(data)) {
                    if (force) {
                        // On forced refresh, clear existing markers so removals are reflected
                        markersRef.current?.clearLayers()
                        displayedReportIdsRef.current.clear()
                    }

                    data.forEach((report: Report) => {
                        addMarkerToMap(report)
                    })
                }
            } catch (error) {
                console.error("Błąd połączenia:", error)
            } finally {
                if (force) {
                    setIsRefreshingReports(false)
                }
            }
        }

        // initial load
        fetchReports()
        fetchReportsRef.current = () => fetchReports(true)

        // auto-refresh every 60s
        const intervalId = window.setInterval(() => {
            fetchReports(true)
        }, 60000)

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
            window.clearInterval(intervalId)
        }
    }, [initialReports, initialLat, initialLng, initialZoom])

    // Format address to show only essential parts
    const formatAddress = (result: SearchResult): string => {
        if (!result.address) {
            // Fallback to first 2-3 parts of display_name
            const parts = result.display_name.split(", ")
            return parts.slice(0, 3).join(", ")
        }

        const parts: string[] = []

        // Add street and number
        if (result.address.road) {
            let street = result.address.road
            if (result.address.house_number) {
                street += " " + result.address.house_number
            }
            parts.push(street)
        }

        // Add city/town/village
        const location = result.address.city || result.address.town || result.address.village || result.address.municipality
        if (location) {
            parts.push(location)
        }

        return parts.length > 0 ? parts.join(", ") : result.display_name.split(", ").slice(0, 2).join(", ")
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

            // Deduplicate results by formatted address (keep first occurrence)
            const seen = new Set<string>()
            const uniqueResults = data.filter((result) => {
                const key = formatAddress(result).toLowerCase()
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })

            setSearchResults(uniqueResults)
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
            mapRef.current.flyTo([lat, lon], 16, {
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
    const performAIAnalysis = useCallback(async (lat: number, lng: number, isUserLocation: boolean = false) => {
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
                        <span class="text-xs text-zinc-500">
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
                        <span class="text-xs text-zinc-500">
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
            const token = await getFreshAccessToken()
            if (!token) {
                throw new Error("Brak tokenu. Zaloguj się ponownie.")
            }

            // Call AI Assistant API
            const response = await fetch("/api/ai-assistant/nearby-threats", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    latitude: lat,
                    longitude: lng,
                    radius_km: 1.0
                })
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(text || "AI analysis failed")
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
            const msg = error instanceof Error ? error.message : "Nie udało się pobrać analizy."
            setAiResponse({
                visible: true,
                dangerLevel: "Błąd",
                dangerScore: 0,
                summary: msg,
                reportsCount: 0
            })
        } finally {
            setAiLoading(false)
            setAiSelectMode(false)
        }
    }, [])

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
    }, [aiSelectMode, performAIAnalysis])

    // Clear selected area marker and circle
    const clearSelectedAreaMarker = () => {
        if (mapRef.current) {
            if (selectedAreaMarkerRef.current) {
                mapRef.current.removeLayer(selectedAreaMarkerRef.current)
                selectedAreaMarkerRef.current = null
            }
            if (selectedAreaCircleRef.current) {
                mapRef.current.removeLayer(selectedAreaCircleRef.current)
                selectedAreaCircleRef.current = null
            }
        }
    }

    // Cancel area selection mode
    const handleCancelSelectMode = () => {
        clearSelectedAreaMarker()
        setAiSelectMode(false)
    }

    // Get danger level color
    const getDangerColor = (level: string) => {
        const normalizedLevel = level.toUpperCase()
        switch (normalizedLevel) {
            case "BARDZO NISKI":
            case "BARDZO_NISKI":
                return "bg-green-500"
            case "NISKI":
                return "bg-green-400"
            case "ŚREDNI":
            case "UMIARKOWANY":
                return "bg-yellow-500"
            case "PODWYŻSZONY":
            case "WYSOKI":
                return "bg-orange-500"
            case "BARDZO WYSOKI":
            case "BARDZO_WYSOKI":
            case "KRYTYCZNY":
                return "bg-red-500"
            default:
                return "bg-zinc-500"
        }
    }

    // Get danger level emoji
    const getDangerEmoji = (level: string) => {
        const normalizedLevel = level.toUpperCase()
        switch (normalizedLevel) {
            case "BARDZO NISKI":
            case "BARDZO_NISKI":
                return "🌟"
            case "NISKI":
                return "✅"
            case "ŚREDNI":
            case "UMIARKOWANY":
                return "⚠️"
            case "PODWYŻSZONY":
            case "WYSOKI":
                return "🔶"
            case "BARDZO WYSOKI":
            case "BARDZO_WYSOKI":
            case "KRYTYCZNY":
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
        clearSelectedAreaMarker()

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

    // Manual refresh handler
    const handleRefreshReports = () => {
        fetchReportsRef.current?.()
    }

    return (
        <>
            {/* Styles moved to globals.css */}

            <div className="relative flex h-full w-full flex-col overflow-hidden">
                {/* Main Content */}
                <main className={`relative flex flex-1 flex-col transition-all duration-300`}>
                    {/* Search Bar */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-4">
                        <div className="search-container pointer-events-auto flex w-full max-w-lg flex-col">
                            <div
                                className={`flex h-24 w-full flex-1 items-stretch shadow-lg backdrop-blur-sm transition-all ${
                                    showResults || isSearching ? "rounded-t-xl" : "rounded-xl"
                                } ${searchFocused ? "ring-2 ring-[#d97706]" : ""}`}
                            >
                                <div
                                    className={`flex items-center justify-center px-5 text-[#e0dcd7]/70 backdrop-blur-sm transition-colors ${
                                        showResults || isSearching ? "rounded-tl-xl" : "rounded-l-xl"
                                    } ${searchFocused ? "bg-[#362c20]" : "bg-[#362c20]/90"}`}
                                >
                                    <span className="material-symbols-outlined text-4xl">search</span>
                                </div>
                                <div className="relative flex h-full w-full flex-1">
                                    <input
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onFocus={() => {
                                            setSearchFocused(true)
                                            if (searchResults.length > 0) {
                                                setShowResults(true)
                                            }
                                        }}
                                        onBlur={() => setSearchFocused(false)}
                                        className={`form-input flex h-full w-full min-w-0 flex-1 resize-none overflow-hidden border-none bg-[#362c20]/90 px-8 py-4 text-lg leading-normal font-normal text-[#e0dcd7] backdrop-blur-sm placeholder:text-[#e0dcd7]/70 focus:bg-[#362c20] focus:outline-none ${showResults || isSearching ? "rounded-tr-xl" : "rounded-r-xl"}`}
                                        placeholder="Wyszukaj lokalizację..."
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={handleClearSearch}
                                            className="absolute top-1/2 right-4 -translate-y-1/2 text-[#e0dcd7]/70 transition-colors hover:text-[#e0dcd7]"
                                            title="Wyczyść"
                                        >
                                            <span className="material-symbols-outlined text-2xl">close</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Search Results Dropdown */}
                            {showResults && searchResults.length > 0 && (
                                <div
                                    className={`max-h-80 w-full overflow-y-auto rounded-b-xl bg-[#362c20]/90 shadow-lg backdrop-blur-sm ${
                                        searchFocused ? "ring-t-0 ring-2 ring-[#d97706]" : ""
                                    }`}
                                >
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
                                <div
                                    className={`w-full rounded-b-xl bg-[#362c20]/90 px-5 py-5 shadow-lg backdrop-blur-sm ${
                                        searchFocused ? "ring-t-0 ring-2 ring-[#d97706]" : ""
                                    }`}
                                >
                                    <div className="flex items-center gap-2 text-[#e0dcd7]">
                                        <span className="text-sm">Wyszukiwanie...</span>
                                    </div>
                                </div>
                            )}

                            {/* No results message */}
                            {!isSearching && showResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                                <div
                                    className={`w-full rounded-b-xl bg-[#362c20]/90 px-5 py-5 shadow-lg backdrop-blur-sm ${
                                        searchFocused ? "ring-t-0 ring-2 ring-[#d97706]" : ""
                                    }`}
                                >
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

                    {/* AI Assistant Buttons - Top Right Corner */}
                    {isAuthenticated && (
                        <div className="ai-assistant-container absolute top-6 right-6 z-20 flex flex-col items-end gap-2">
                            {/* Main AI Assistant Button */}
                            <button
                                onClick={() => setAiMenuOpen(!aiMenuOpen)}
                                disabled={aiLoading || aiSelectMode}
                                className={`flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg ${
                                    aiLoading
                                        ? "cursor-wait bg-[#362c20]/70"
                                        : aiSelectMode
                                          ? "cursor-not-allowed bg-zinc-400"
                                          : aiMenuOpen
                                            ? "bg-[#362c20] ring-2 ring-[#d97706]"
                                            : "bg-[#362c20]/90 hover:bg-[#362c20] hover:ring-1 hover:ring-[#d97706]"
                                } font-semibold text-[#e0dcd7] transition-all duration-300 hover:scale-105 hover:shadow-xl`}
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
                                            {aiMenuOpen ? "expand_less" : "expand_more"}
                                        </span>
                                    </>
                                )}
                            </button>

                            {/* Area Selection Mode Active Banner */}
                            {aiSelectMode && (
                                <div className="animate-in fade-in mt-2 flex items-center gap-2 rounded-xl bg-[#362c20]/95 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
                                    <span className="text-xl">🎯</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">Tryb wyboru obszaru</p>
                                        <p className="text-xs text-white/70">Kliknij na mapę, aby wybrać punkt do analizy</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            handleCancelSelectMode()
                                            setAiMenuOpen(false)
                                        }}
                                        className="rounded-lg bg-white/10 p-1.5 transition-colors hover:bg-white/20"
                                        title="Anuluj"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>
                            )}

                            {/* AI Menu Options - shown when menu is open */}
                            {aiMenuOpen && !aiSelectMode && !aiLoading && (
                                <div className="animate-in fade-in slide-in-from-top-2 mt-2 flex flex-col gap-2 duration-200">
                                    {/* Option 1: My Location */}
                                    <button
                                        onClick={() => {
                                            handleAIAnalysisMyLocation()
                                            setAiMenuOpen(false)
                                        }}
                                        className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] px-4 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-[#2563eb] hover:to-[#1d4ed8] hover:shadow-xl"
                                        title="Analizuj bezpieczeństwo w mojej lokalizacji"
                                    >
                                        <span className="material-symbols-outlined">my_location</span>
                                        <span>Moja lokalizacja</span>
                                    </button>

                                    {/* Option 2: Select on map */}
                                    <button
                                        onClick={() => {
                                            handleAISelectArea()
                                            setAiMenuOpen(false)
                                        }}
                                        className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#d97706] to-[#ea580c] px-4 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-[#ea580c] hover:to-[#dc2626] hover:shadow-xl"
                                        title="Wybierz obszar na mapie do analizy"
                                    >
                                        <span className="text-xl">🎯</span>
                                        <span>Wybierz na mapie</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* AI Response Bubble */}
                    {aiResponse?.visible && (
                        <div className="animate-in fade-in slide-in-from-top-4 absolute top-24 right-6 z-30 max-w-sm duration-300">
                            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                                {/* Colored accent bar */}
                                <div className="h-1 bg-gradient-to-r from-[#06b6d4] to-[#0891b2]"></div>
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
                                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-800 px-4 py-2">
                                    <span className="text-sm font-medium text-zinc-300">Poziom zagrożenia:</span>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`rounded-full px-3 py-1 text-sm font-bold text-white ${getDangerColor(aiResponse.dangerLevel)} `}
                                        >
                                            {aiResponse.dangerLevel}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            ({Math.round(aiResponse.dangerScore)}/100)
                                        </span>
                                    </div>
                                </div>

                                {/* AI Summary */}
                                <div className="px-4 py-4">
                                    <p className="text-sm leading-relaxed text-zinc-300">{aiResponse.summary}</p>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-800 px-4 py-2">
                                    <span className="text-xs">🤖</span>
                                    <span className="text-xs text-zinc-400">Analiza wygenerowana przez AI • RiskRadar</span>
                                </div>
                            </div>

                            {/* Speech bubble arrow pointing up */}
                            <div className="absolute -top-2 right-8 h-4 w-4 rotate-45 transform border-t border-l border-zinc-800 bg-zinc-900"></div>
                        </div>
                    )}

                    {/* Map Controls */}
                    <div className="absolute right-6 bottom-6 z-20 flex items-end justify-end gap-3">
                        <div className="flex flex-col items-end gap-3">
                            <button
                                onClick={handleRefreshReports}
                                className="flex size-10 items-center justify-center rounded-lg bg-[#362c20] text-[#e0dcd7] shadow-lg transition-all hover:bg-[#362c20]/80 hover:shadow-xl"
                                title="Odśwież raporty"
                            >
                                <span className="material-symbols-outlined text-lg">
                                    {isRefreshingReports ? "progress_activity" : "refresh"}
                                </span>
                            </button>
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
                        className="relative flex items-center justify-center rounded-lg bg-zinc-900 p-2 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span
                            className="absolute -top-4 -right-4 z-[10000] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-zinc-700 bg-zinc-800 text-white shadow-lg hover:bg-zinc-700"
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
