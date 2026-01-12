"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useMemo, Suspense } from "react"
import dynamic from "next/dynamic"
import { Report } from "./map-component"

// Dynamically import the MapComponent to disable server-side rendering
const MapComponent = dynamic(() => import("./map-component"), {
    ssr: false,
    loading: () => (
        <div className="flex h-screen items-center justify-center bg-[#2a221a]">
            <div className="text-lg text-[#e0dcd7]">Loading map...</div>
        </div>
    )
})

interface MapWrapperProps {
    initialReports: Report[]
}

// MapContent component that handles the map's state and props
function MapContent({ initialReports }: MapWrapperProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Get initial latitude and longitude from the URL search params
    const latParam = searchParams.get("lat")
    const lngParam = searchParams.get("lng")

    const initialLat = latParam ? parseFloat(latParam) : undefined
    const initialLng = lngParam ? parseFloat(lngParam) : undefined

    // Create a unique key for the map to force a re-render when the path or search params change
    const mapKey = useMemo(() => `map-${pathname}-${latParam}-${lngParam}`, [pathname, latParam, lngParam])

    return (
        <div className="h-screen w-full">
            <MapComponent key={mapKey} initialReports={initialReports} initialLat={initialLat} initialLng={initialLng} />
        </div>
    )
}

// MapWrapper component that wraps the MapContent in a Suspense boundary
export default function MapWrapper(props: MapWrapperProps) {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center bg-[#2a221a] text-[#e0dcd7]">Loading...</div>
            }
        >
            <MapContent {...props} />
        </Suspense>
    )
}
