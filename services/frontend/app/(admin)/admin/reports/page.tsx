"use client"

import { useState, useEffect, useCallback } from "react"
import { Table } from "@/components/ui/table/table"
import { TableHead } from "@/components/ui/table/table-head"
import { TableHeader } from "@/components/ui/table/table-header"
import { TableBody } from "@/components/ui/table/table-body"
import { TableRow } from "@/components/ui/table/table-row"
import { TableCell } from "@/components/ui/table/table-cell"
import { Search, Filter, ChevronLeft, ChevronRight, Pencil, Trash2, Eye, X, Check, Loader2, RefreshCw } from "lucide-react"

interface Report {
    id: string
    title: string
    description: string
    category: string
    status: "PENDING" | "VERIFIED" | "REJECTED"
    createdAt: string
    userId: string
    latitude: number
    longitude: number
    aiIsFake?: boolean
    aiFakeProbability?: number
    imageIds?: string[]
}

interface PaginatedResponsePageMeta {
    size: number
    number: number
    totalElements: number
    totalPages: number
}

interface PaginatedResponse {
    content: Report[]
    totalPages?: number
    totalElements?: number
    number?: number
    size?: number
    page?: PaginatedResponsePageMeta
}

// Using Next.js API route handlers to proxy requests to report-service
const API_BASE = "/api/admin/reports"

const CATEGORY_NAMES: Record<string, string> = {
    VANDALISM: "Wandalizm",
    INFRASTRUCTURE: "Infrastruktura",
    DANGEROUS_SITUATION: "Niebezpieczna sytuacja",
    TRAFFIC_ACCIDENT: "Wypadek drogowy",
    PARTICIPANT_BEHAVIOR: "Zachowania uczestników",
    PARTICIPANT_HAZARD: "Zagrożenia",
    WASTE_ILLEGAL_DUMPING: "Nielegalne wysypiska",
    BIOLOGICAL_HAZARD: "Zagrożenia biologiczne",
    OTHER: "Inne"
}

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-yellow-500/20 text-yellow-400",
    VERIFIED: "bg-green-500/20 text-green-400",
    REJECTED: "bg-red-500/20 text-red-400"
}

const STATUS_NAMES: Record<string, string> = {
    PENDING: "Oczekuje",
    VERIFIED: "Zweryfikowane",
    REJECTED: "Odrzucone"
}

export default function AdminReportsPage() {
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [categoryFilter, setCategoryFilter] = useState<string>("all")
    // 0-based paging, to align with backend and my-reports
    const [currentPage, setCurrentPage] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [totalElements, setTotalElements] = useState(0)
    const [editingReport, setEditingReport] = useState<Report | null>(null)
    const [viewingReport, setViewingReport] = useState<Report | null>(null)
    const pageSize = 10

    const fetchReports = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                size: String(pageSize),
                sort: "createdAt",
                direction: "desc"
            })

            if (statusFilter !== "all") {
                params.append("status", statusFilter)
            }
            if (categoryFilter !== "all") {
                params.append("category", categoryFilter)
            }

            const response = await fetch(`${API_BASE}?${params}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`
                }
            })
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data: PaginatedResponse = await response.json()

            console.log("[Admin Reports] API Response:", JSON.stringify(data, null, 2))

            setReports(data.content)

            // Safe number helper (mirrors my-reports)
            const toNumber = (value: unknown, fallback: number): number => {
                const num = Number(value)
                return !isNaN(num) && isFinite(num) ? num : fallback
            }

            const pageInfo = (data.page as Record<string, unknown> | undefined) ?? data

            const elements = toNumber(pageInfo?.totalElements ?? data.totalElements ?? data.content.length, 0)
            const apiTotalPages = toNumber(pageInfo?.totalPages ?? data.totalPages, 0)
            const apiPageSize = toNumber(pageInfo?.size ?? data.size, pageSize)

            const effectiveSize = apiPageSize > 0 ? apiPageSize : pageSize
            const computedPages = Math.max(1, Math.ceil((elements || 0) / effectiveSize))
            const pages = apiTotalPages > 0 ? apiTotalPages : computedPages

            console.log("[Admin Reports] Computed:", { elements, apiTotalPages, computedPages, pages, effectiveSize })

            setTotalPages(pages)
            setTotalElements(elements)
            // Don't override currentPage from state unless we need to clamp it
            if (currentPage >= pages) {
                setCurrentPage(Math.max(0, pages - 1))
            }
        } catch (err) {
            console.error("Failed to fetch reports:", err)
            setError("Nie udało się pobrać zgłoszeń. Sprawdź czy serwis jest uruchomiony.")
            setReports([])
        } finally {
            setLoading(false)
        }
    }, [currentPage, statusFilter, categoryFilter])

    useEffect(() => {
        fetchReports()
    }, [fetchReports])

    // Client-side filtering for search (server doesn't support text search)
    const filteredReports = reports.filter((report) => {
        if (!search) return true
        const matchesSearch =
            report.title.toLowerCase().includes(search.toLowerCase()) ||
            report.description.toLowerCase().includes(search.toLowerCase())
        return matchesSearch
    })

    const handleDelete = async (id: string) => {
        if (confirm("Czy na pewno chcesz usunąć to zgłoszenie?")) {
            try {
                const response = await fetch(`${API_BASE}/${id}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`
                    }
                })
                if (response.ok) {
                    fetchReports()
                } else {
                    alert("Nie udało się usunąć zgłoszenia")
                }
            } catch (err) {
                console.error("Delete failed:", err)
                alert("Błąd podczas usuwania zgłoszenia")
            }
        }
    }

    const handleEdit = (report: Report) => {
        setEditingReport(report)
    }

    const handleSaveEdit = async () => {
        if (editingReport) {
            try {
                const reportRequest = {
                    title: editingReport.title,
                    description: editingReport.description,
                    latitude: editingReport.latitude,
                    longitude: editingReport.longitude,
                    userId: editingReport.userId,
                    reportCategory: editingReport.category,
                    imageIds: editingReport.imageIds || []
                }

                const response = await fetch(`${API_BASE}/${editingReport.id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`
                    },
                    body: JSON.stringify(reportRequest)
                })

                if (response.ok) {
                    fetchReports()
                    setEditingReport(null)
                } else {
                    const errorData = await response.json().catch(() => ({}))
                    console.error("Update failed:", errorData)
                    alert(
                        `Nie udało się zaktualizować zgłoszenia: ${errorData.error || errorData.message || response.statusText}`
                    )
                }
            } catch (err) {
                console.error("Update failed:", err)
                alert(`Błąd podczas aktualizacji: ${err instanceof Error ? err.message : "Unknown error"}`)
            }
        }
    }

    const handleStatusChange = async (id: string, newStatus: Report["status"]) => {
        try {
            const response = await fetch(`${API_BASE}/${id}?status=${newStatus}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`
                }
            })
            if (response.ok) {
                // Update local state immediately for better UX
                setReports(reports.map((r) => (r.id === id ? { ...r, status: newStatus } : r)))
            } else {
                alert("Nie udało się zmienić statusu")
            }
        } catch (err) {
            console.error("Status change failed:", err)
            // Fallback to local update
            setReports(reports.map((r) => (r.id === id ? { ...r, status: newStatus } : r)))
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                <p className="mb-4 text-red-400">{error}</p>
                <button
                    onClick={fetchReports}
                    className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-zinc-300 hover:bg-zinc-700"
                >
                    <RefreshCw className="h-4 w-4" />
                    Spróbuj ponownie
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Wszystkie zgłoszenia</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        Zarządzaj zgłoszeniami użytkowników ({totalElements} łącznie)
                    </p>
                </div>
                <button
                    onClick={fetchReports}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    title="Odśwież"
                >
                    <RefreshCw className="h-5 w-5" />
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Szukaj zgłoszeń..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pr-4 pl-10 text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-zinc-500" />
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setCurrentPage(1)
                        }}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-700 focus:outline-none"
                    >
                        <option value="all">Wszystkie statusy</option>
                        <option value="PENDING">Oczekujące</option>
                        <option value="VERIFIED">Zweryfikowane</option>
                        <option value="REJECTED">Odrzucone</option>
                    </select>
                    <select
                        value={categoryFilter}
                        onChange={(e) => {
                            setCategoryFilter(e.target.value)
                            setCurrentPage(1)
                        }}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-700 focus:outline-none"
                    >
                        <option value="all">Wszystkie kategorie</option>
                        {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                            <option key={key} value={key}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tytuł</TableHead>
                            <TableHead>Kategoria</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Akcje</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredReports.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-8 text-center">
                                    <p className="text-zinc-500">Brak zgłoszeń do wyświetlenia</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredReports.map((report) => (
                                <TableRow key={report.id} className="hover:bg-zinc-800/50">
                                    <TableCell>
                                        <div>
                                            <p className="font-medium text-zinc-100">{report.title}</p>
                                            <p className="max-w-[200px] truncate text-xs text-zinc-500">
                                                {report.description}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-zinc-300">
                                            {CATEGORY_NAMES[report.category] || report.category}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <select
                                            value={report.status}
                                            onChange={(e) =>
                                                handleStatusChange(report.id, e.target.value as Report["status"])
                                            }
                                            className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLES[report.status]} cursor-pointer border-0 bg-transparent`}
                                        >
                                            <option value="PENDING">Oczekuje</option>
                                            <option value="VERIFIED">Zweryfikowane</option>
                                            <option value="REJECTED">Odrzucone</option>
                                        </select>
                                    </TableCell>

                                    <TableCell>
                                        <span className="text-sm text-zinc-400">
                                            {new Date(report.createdAt).toLocaleDateString("pl-PL")}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setViewingReport(report)}
                                                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                                                title="Podgląd"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(report)}
                                                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-blue-400"
                                                title="Edytuj"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(report.id)}
                                                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-red-400"
                                                title="Usuń"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                    Strona {currentPage + 1} z {totalPages || 1}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ChevronLeft className="h-4 w-4 text-zinc-400" />
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                        {(() => {
                            const pages = []
                            const maxVisible = 5
                            let start = Math.max(0, currentPage - Math.floor(maxVisible / 2))
                            const end = Math.min(totalPages, start + maxVisible)

                            if (end - start < maxVisible) {
                                start = Math.max(0, end - maxVisible)
                            }

                            if (start > 0) {
                                pages.push(
                                    <button
                                        key={0}
                                        onClick={() => setCurrentPage(0)}
                                        className="min-w-[32px] rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm hover:bg-zinc-800"
                                    >
                                        1
                                    </button>
                                )
                                if (start > 1) {
                                    pages.push(
                                        <span key="start-ellipsis" className="px-1 text-zinc-500">
                                            ...
                                        </span>
                                    )
                                }
                            }

                            for (let i = start; i < end; i++) {
                                pages.push(
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i)}
                                        className={`min-w-[32px] rounded-lg border px-2 py-1 text-sm ${
                                            i === currentPage
                                                ? "border-blue-500 bg-blue-500/20 text-blue-400"
                                                : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                )
                            }

                            if (end < totalPages) {
                                if (end < totalPages - 1) {
                                    pages.push(
                                        <span key="end-ellipsis" className="px-1 text-zinc-500">
                                            ...
                                        </span>
                                    )
                                }
                                pages.push(
                                    <button
                                        key={totalPages - 1}
                                        onClick={() => setCurrentPage(totalPages - 1)}
                                        className="min-w-[32px] rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm hover:bg-zinc-800"
                                    >
                                        {totalPages}
                                    </button>
                                )
                            }

                            return pages
                        })()}
                    </div>

                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1 || totalPages === 0}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* View Modal */}
            {viewingReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="mx-4 w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                        <div className="mb-4 flex items-start justify-between">
                            <h2 className="text-xl font-semibold text-zinc-100">{viewingReport.title}</h2>
                            <button onClick={() => setViewingReport(null)} className="rounded p-1 hover:bg-zinc-800">
                                <X className="h-5 w-5 text-zinc-400" />
                            </button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-zinc-500">Opis:</span>
                                <p className="mt-1 text-zinc-300">{viewingReport.description}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-zinc-500">Kategoria:</span>
                                    <p className="text-zinc-300">{CATEGORY_NAMES[viewingReport.category]}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Status:</span>
                                    <p className={STATUS_STYLES[viewingReport.status].replace("bg-", "text-").split(" ")[1]}>
                                        {STATUS_NAMES[viewingReport.status]}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Lokalizacja:</span>
                                    <p className="text-zinc-300">
                                        {viewingReport.latitude.toFixed(4)}, {viewingReport.longitude.toFixed(4)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Data utworzenia:</span>
                                    <p className="text-zinc-300">
                                        {new Date(viewingReport.createdAt).toLocaleString("pl-PL")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="mx-4 w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                        <div className="mb-4 flex items-start justify-between">
                            <h2 className="text-xl font-semibold text-zinc-100">Edytuj zgłoszenie</h2>
                            <button onClick={() => setEditingReport(null)} className="rounded p-1 hover:bg-zinc-800">
                                <X className="h-5 w-5 text-zinc-400" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm text-zinc-400">Tytuł</label>
                                <input
                                    type="text"
                                    value={editingReport.title}
                                    onChange={(e) => setEditingReport({ ...editingReport, title: e.target.value })}
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-zinc-400">Opis</label>
                                <textarea
                                    value={editingReport.description}
                                    onChange={(e) => setEditingReport({ ...editingReport, description: e.target.value })}
                                    rows={3}
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-zinc-400">Kategoria</label>
                                <select
                                    value={editingReport.category}
                                    onChange={(e) => setEditingReport({ ...editingReport, category: e.target.value })}
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                                >
                                    {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                                        <option key={key} value={key}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-zinc-400">Status</label>
                                <select
                                    value={editingReport.status}
                                    onChange={(e) =>
                                        setEditingReport({ ...editingReport, status: e.target.value as Report["status"] })
                                    }
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                                >
                                    <option value="PENDING">Oczekuje</option>
                                    <option value="VERIFIED">Zweryfikowane</option>
                                    <option value="REJECTED">Odrzucone</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => setEditingReport(null)}
                                    className="rounded-lg bg-zinc-800 px-4 py-2 text-zinc-300 hover:bg-zinc-700"
                                >
                                    Anuluj
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
                                >
                                    <Check className="h-4 w-4" />
                                    Zapisz
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
