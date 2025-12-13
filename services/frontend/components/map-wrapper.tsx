'use client'

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
    return <MapComponent initialReports={initialReports} />
}
