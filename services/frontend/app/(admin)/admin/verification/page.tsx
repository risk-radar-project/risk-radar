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
        const res = await fetch(`${REPORT_SERVICE_URL}/pending`, {
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

export default async function AdminVerificationPage() {
    const reports = await getUnverifiedReports()

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Weryfikacja zgłoszeń</h1>
                <p className="mt-1 text-sm text-zinc-400">Lista zgłoszeń oczekujących na weryfikację ({reports.length})</p>
            </div>

            <div className="space-y-4">
                {reports.length === 0 ? (
                    <SectionCard className="border-zinc-800 bg-zinc-900">
                        <div className="py-12 text-center">
                            <p className="text-lg text-zinc-400">Brak zgłoszeń do weryfikacji</p>
                            <p className="mt-2 text-sm text-zinc-500">Wszystkie zgłoszenia zostały już zweryfikowane</p>
                        </div>
                    </SectionCard>
                ) : (
                    reports.map((report) => <ReportCard key={report.id} report={report} />)
                )}
            </div>
        </div>
    )
}
