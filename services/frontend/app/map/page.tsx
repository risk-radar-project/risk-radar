export const revalidate = 15

import { Report } from "@/components/map-component"
import MapWrapper from "@/components/map-wrapper"

async function getInitialReports(): Promise<Report[]> {
    const MAP_SERVICE_URL = process.env.MAP_SERVICE_URL || "http://127.0.0.1:8086"

    try {
        // Fetch from map-service
        const res = await fetch(`${MAP_SERVICE_URL}/reports`, {
            next: { revalidate }
        })

        if (!res.ok) {
            console.error("Server side fetch failed:", res.status, await res.text())
            // Return empty array to allow map to load without initial markers
            return []
        }

        const data = await res.json()
        console.log(`[Server] Pobrano ${Array.isArray(data) ? data.length : 0} raportów z backendu.`)
        return data
    } catch (error) {
        console.error("Server side fetch error:", error)
        return []
    }
}

export default async function MapPage() {
    const reports = await getInitialReports()

    return <MapWrapper initialReports={reports} />
}
