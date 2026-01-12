// Revalidate the page every 15 seconds
export const revalidate = 15

import { Report } from "@/components/map-component"
import MapWrapper from "@/components/map-wrapper"

// Fetches initial reports from the map-service
async function getInitialReports(): Promise<Report[]> {
    const MAP_SERVICE_URL = process.env.MAP_SERVICE_URL || "http://127.0.0.1:8086"

    try {
        // Fetch reports from the map-service
        const res = await fetch(`${MAP_SERVICE_URL}/reports`, {
            next: { revalidate }
        })

        if (!res.ok) {
            console.error("Server side fetch failed:", res.status, await res.text())
            // Return empty array to allow map to load without initial markers
            return []
        }

        const data = await res.json()
        console.log(`[Server] Fetched ${Array.isArray(data) ? data.length : 0} reports from backend.`)
        return data
    } catch (error) {
        console.error("Server side fetch error:", error)
        return []
    }
}

// Home page component
export default async function HomePage() {
    // Fetch initial reports
    const reports = await getInitialReports()

    // Render the map with the initial reports
    return <MapWrapper initialReports={reports} />
}
