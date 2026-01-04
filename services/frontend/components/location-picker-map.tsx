"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface LocationPickerMapProps {
    onLocationSelect: (lat: number, lng: number) => void
    initialLat?: number
    initialLng?: number
}

const createLocationIcon = () => {
    const svgIcon = `
        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(20, 5)">
                <circle cx="0" cy="10" r="8" fill="#d97706" stroke="#ffffff" stroke-width="2"/>
                <circle cx="0" cy="10" r="4" fill="#ffffff"/>
                <path d="M 0 18 Q -6 25 0 32 Q 6 25 0 18 Z" fill="#d97706" stroke="#ffffff" stroke-width="1.5"/>
            </g>
        </svg>
    `
    const iconDataUrl = `data:image/svg+xml;base64,${btoa(svgIcon)}`

    return L.icon({
        iconUrl: iconDataUrl,
        iconSize: [40, 40],
        iconAnchor: [20, 37],
        popupAnchor: [0, -37]
    })
}

export default function LocationPickerMap({
    onLocationSelect,
    initialLat = 50.06,
    initialLng = 19.94
}: LocationPickerMapProps) {
    const mapRef = useRef<L.Map | null>(null)
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const markerRef = useRef<L.Marker | null>(null)
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [isLocating, setIsLocating] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)

    // Search for locations using Nominatim API
    const handleSearch = async () => {
        if (!searchQuery.trim() || !mapRef.current) return

        setIsSearching(true)
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
            )
            const data = await response.json()

            if (data && data.length > 0) {
                const result = data[0]
                const lat = parseFloat(result.lat)
                const lng = parseFloat(result.lon)

                // Fly to location
                mapRef.current.flyTo([lat, lng], 15, { duration: 1.5 })

                // Remove existing marker
                if (markerRef.current) {
                    mapRef.current.removeLayer(markerRef.current)
                }

                // Add marker at searched location
                const marker = L.marker([lat, lng], { icon: createLocationIcon() })
                    .addTo(mapRef.current)
                    .bindPopup(`<b>${result.display_name}</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`)
                    .openPopup()

                markerRef.current = marker
                setSelectedLocation({ lat, lng })
                onLocationSelect(lat, lng)
            }
        } catch (error) {
            console.error("Search error:", error)
        } finally {
            setIsSearching(false)
        }
    }

    // Load Leaflet CSS
    useEffect(() => {
        const link = document.createElement("link")
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        link.rel = "stylesheet"
        document.head.appendChild(link)

        return () => {
            document.head.removeChild(link)
        }
    }, [])

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return

        // Initialize map
        const map = L.map(mapContainerRef.current, {
            attributionControl: false,
            zoomControl: false
        }).setView([initialLat, initialLng], 13)
        mapRef.current = map

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

        // Add click handler to map
        map.on("click", (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng

            // Remove existing marker if any
            if (markerRef.current) {
                map.removeLayer(markerRef.current)
            }

            // Add new marker with custom icon
            const marker = L.marker([lat, lng], { icon: createLocationIcon() })
                .addTo(map)
                .bindPopup(`<b>Wybrana lokalizacja</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`)
                .openPopup()

            markerRef.current = marker
            setSelectedLocation({ lat, lng })
            onLocationSelect(lat, lng)
        })

        // Cleanup
        return () => {
            map.remove()
            mapRef.current = null
        }
    }, [initialLat, initialLng, onLocationSelect])

    const handleUseMyLocation = () => {
        setIsLocating(true)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude
                    const lng = position.coords.longitude

                    // Remove existing marker
                    if (markerRef.current && mapRef.current) {
                        mapRef.current.removeLayer(markerRef.current)
                    }

                    // Add marker at user's location
                    if (mapRef.current) {
                        const marker = L.marker([lat, lng], { icon: createLocationIcon() })
                            .addTo(mapRef.current)
                            .bindPopup(`<b>Twoja lokalizacja</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`)
                            .openPopup()

                        markerRef.current = marker
                        mapRef.current.flyTo([lat, lng], 16, { duration: 1.5 })
                    }

                    setSelectedLocation({ lat, lng })
                    onLocationSelect(lat, lng)
                    setIsLocating(false)
                },
                (error) => {
                    console.error("Geolocation error:", error)
                    alert("Nie można pobrać Twojej lokalizacji: " + error.message)
                    setIsLocating(false)
                }
            )
        } else {
            alert("Geolokalizacja nie jest wspierana przez twoją przeglądarkę")
            setIsLocating(false)
        }
    }

    const handleZoomIn = () => {
        mapRef.current?.zoomIn()
    }

    const handleZoomOut = () => {
        mapRef.current?.zoomOut()
    }

    return (
        <div className="relative w-full h-[400px] rounded-lg overflow-hidden border-2 border-[#e0dcd7]/20">
            {/* Map Container */}
            <div ref={mapContainerRef} className="h-full w-full" />

            {/* Search Box */}
            <div className="absolute bottom-4 left-4 z-[1000] flex gap-2">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Wyszukaj lokalizację..."
                    className="px-4 py-2 bg-[#362c20]/95 backdrop-blur-sm text-[#e0dcd7] rounded-lg border border-[#e0dcd7]/20 focus:border-[#d97706] focus:outline-none transition-colors placeholder:text-[#e0dcd7]/50 w-64"
                />
                <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-4 py-2 bg-[#d97706] hover:bg-[#d97706]/80 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-sm">search</span>
                    {isSearching ? "Szukam..." : "Szukaj"}
                </button>
            </div>

            {/* Instructions Overlay */}
            {!selectedLocation && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-[#362c20]/95 backdrop-blur-sm px-6 py-3 rounded-lg shadow-lg">
                    <p className="text-[#e0dcd7] text-sm font-semibold flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#d97706]">touch_app</span>
                        Kliknij na mapie aby wybrać lokalizację
                    </p>
                </div>
            )}

            {/* Selected Location Display */}
            {selectedLocation && (
                <div className="absolute top-4 left-4 z-[1000] bg-[#362c20]/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
                    <p className="text-[#e0dcd7] text-xs">
                        <span className="font-semibold text-[#d97706]">Współrzędne:</span>
                        <br />
                        {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                    </p>
                </div>
            )}

            {/* Control Buttons */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
                {/* Zoom Controls */}
                <div className="flex flex-col gap-0.5 shadow-lg">
                    <button
                        type="button"
                        onClick={handleZoomIn}
                        className="flex size-10 items-center justify-center rounded-t-lg bg-[#362c20] hover:bg-[#362c20]/80 transition-colors"
                        title="Przybliż"
                    >
                        <span className="material-symbols-outlined text-[#e0dcd7]">add</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleZoomOut}
                        className="flex size-10 items-center justify-center rounded-b-lg bg-[#362c20] hover:bg-[#362c20]/80 transition-colors"
                        title="Oddal"
                    >
                        <span className="material-symbols-outlined text-[#e0dcd7]">remove</span>
                    </button>
                </div>

                {/* My Location Button */}
                <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={isLocating}
                    className="flex size-10 items-center justify-center rounded-lg bg-[#d97706] shadow-lg hover:bg-[#d97706]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Użyj mojej lokalizacji"
                >
                    <span className="material-symbols-outlined text-white">
                        {isLocating ? "progress_activity" : "my_location"}
                    </span>
                </button>
            </div>
        </div>
    )
}
