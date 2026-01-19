export const revalidate = 15

import { Report } from "@/components/map-component"
import MapWrapper from "@/components/map-wrapper"

async function getInitialReports(): Promise<Report[]> {
    const GATEWAY_URL = process.env.GATEWAY_URL || "http://api-gateway:8080"

    try {
        // Fetch from api-gateway which routes to map-service
        const res = await fetch(`${GATEWAY_URL}/api/map/reports`, {
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
