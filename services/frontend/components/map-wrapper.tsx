"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"
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

export default function MapWrapper({ initialReports }: MapWrapperProps) {
    const pathname = usePathname()
    const mapKey = useMemo(() => `map-${pathname}`, [pathname])

    return (
        <div className="h-screen w-full">
            <MapComponent key={mapKey} initialReports={initialReports} />
        </div>
    )
}
