'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Report } from './map-component'

const MapComponent = dynamic(() => import('./map-component'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-screen bg-[#2a221a]">
            <div className="text-[#e0dcd7] text-lg">Ładowanie mapy...</div>
        </div>
    )
})

interface MapWrapperProps {
    initialReports: Report[]
}

export default function MapWrapper({ initialReports }: MapWrapperProps) {
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)

    // Force re-mount on navigation by using pathname + timestamp
    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [pathname])

    // Create unique key based on mount state to force re-render
    const mapKey = `map-${pathname}-${mounted ? Date.now() : 0}`

    return <MapComponent key={mapKey} initialReports={initialReports} />
}
