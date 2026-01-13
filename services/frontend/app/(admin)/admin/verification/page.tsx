"use client"

import { useState, useEffect } from "react"
import { SectionCard } from "@/components/shared/section-card"
import { ReportCard, Report } from "@/components/reports/report-card"

export default function AdminVerificationPage() {
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchReports() {
            try {
                const token = localStorage.getItem("access_token")
                const res = await fetch("/api/reports/pending", {
                    cache: "no-store",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if (!res.ok) {
                    const errorText = await res.text()
                    console.error("Failed to fetch unverified reports:", res.status, errorText)
                    setError(`Nie udało się pobrać zgłoszeń: ${res.status}`)
                    return
                }

                const data = await res.json()
                setReports(data)
            } catch (err) {
                console.error("Error fetching unverified reports:", err)
                setError("Błąd połączenia z serwerem")
            } finally {
                setLoading(false)
            }
        }

        fetchReports()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300"></div>
            </div>
        )
    }

    if (error) {
        return (
            <SectionCard className="border-zinc-800 bg-zinc-900">
                <div className="py-12 text-center">
                    <p className="text-lg text-red-400">{error}</p>
                </div>
            </SectionCard>
        )
    }

    const handleReportProcessed = (id: string) => {
        setReports((prev) => prev.filter((r) => r.id !== id))
    }

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
                    reports.map((report) => (
                        <ReportCard key={report.id} report={report} onProcessed={handleReportProcessed} />
                    ))
                )}
            </div>
        </div>
    )
}
