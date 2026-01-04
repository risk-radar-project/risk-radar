// This is a Server Component
// Force dynamic rendering - no caching
export const dynamic = "force-dynamic"
export const revalidate = 0

import { SectionCard } from "@/components/shared/section-card"
import { ReportCard, Report } from "@/components/reports/report-card"

async function getUnverifiedReports(): Promise<Report[]> {
    const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || "http://127.0.0.1:8085"

    try {
        // Fetch unverified reports from report-service
        const res = await fetch(`${REPORT_SERVICE_URL}/reports/pending`, {
            cache: "no-store"
        })

        if (!res.ok) {
            console.error("Failed to fetch unverified reports:", res.status, await res.text())
            return []
        }

        const data = await res.json()
        console.log(`[Server] Fetched ${Array.isArray(data) ? data.length : 0} unverified reports`)
        return data
    } catch (error) {
        console.error("Error fetching unverified reports:", error)
        return []
    }
}

export default async function ReportsListingPage() {
    const reports = await getUnverifiedReports()

    return (
        <>
            <div className="mb-6 mt-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-[#e0dcd7]">Zgłoszenia do weryfikacji</h1>
                <p className="text-sm text-[#e0dcd7]/70 mt-2">
                    Lista zgłoszeń oczekujących na weryfikację ({reports.length})
                </p>
            </div>

            <div className="space-y-4 px-6 py-4">
                {reports.length === 0 ? (
                    <SectionCard className="bg-[#362c20] border-[#e0dcd7]/10">
                        <div className="text-center py-12">
                            <p className="text-zinc-400 text-lg">Brak zgłoszeń do weryfikacji</p>
                            <p className="text-zinc-500 text-sm mt-2">Wszystkie zgłoszenia zostały już zweryfikowane</p>
                        </div>
                    </SectionCard>
                ) : (
                    reports.map((report) => <ReportCard key={report.id} report={report} />)
                )}
            </div>
        </>
    )
}
