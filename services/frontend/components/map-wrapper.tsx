"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useMemo, Suspense } from "react"
import dynamic from "next/dynamic"
import { Report } from "./map-component"

const MapComponent = dynamic(() => import("./map-component"), {
    ssr: false,
    loading: () => (
        <div className="flex h-screen items-center justify-center bg-[#2a221a]">
            <div className="text-lg text-[#e0dcd7]">Ładowanie mapy...</div>
        </div>
    )
})

interface MapWrapperProps {
    initialReports: Report[]
}

function MapContent({ initialReports }: MapWrapperProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const latParam = searchParams.get("lat")
    const lngParam = searchParams.get("lng")

    const initialLat = latParam ? parseFloat(latParam) : undefined
    const initialLng = lngParam ? parseFloat(lngParam) : undefined

    const mapKey = useMemo(() => `map-${pathname}-${latParam}-${lngParam}`, [pathname, latParam, lngParam])

    return (
        <div className="h-screen w-full">
            <MapComponent key={mapKey} initialReports={initialReports} initialLat={initialLat} initialLng={initialLng} />
        </div>
    )
}

export default function MapWrapper(props: MapWrapperProps) {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center bg-[#2a221a] text-[#e0dcd7]">Ładowanie...</div>
            }
        >
            <MapContent {...props} />
        </Suspense>
    )
}
