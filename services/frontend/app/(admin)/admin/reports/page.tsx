"use client"

import { useState, useEffect, useCallback } from "react"
import { Table } from "@/components/ui/table/table"
import { TableHead } from "@/components/ui/table/table-head"
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
}

interface PaginatedResponse {
    content: Report[]
    totalPages: number
    totalElements: number
    number: number
    size: number
}

// Using Next.js API route handlers to proxy requests to report-service
const API_BASE = "/api/admin/reports"

const CATEGORY_NAMES: Record<string, string> = {
    'VANDALISM': 'Wandalizm',
    'INFRASTRUCTURE': 'Infrastruktura',
    'DANGEROUS_SITUATION': 'Niebezpieczna sytuacja',
    'TRAFFIC_ACCIDENT': 'Wypadek drogowy',
    'PARTICIPANT_BEHAVIOR': 'Zachowania uczestników',
    'PARTICIPANT_HAZARD': 'Zagrożenia',
    'WASTE_ILLEGAL_DUMPING': 'Nielegalne wysypiska',
    'BIOLOGICAL_HAZARD': 'Zagrożenia biologiczne',
    'OTHER': 'Inne'
}

const STATUS_STYLES: Record<string, string> = {
    'PENDING': 'bg-yellow-500/20 text-yellow-400',
    'VERIFIED': 'bg-green-500/20 text-green-400',
    'REJECTED': 'bg-red-500/20 text-red-400'
}

const STATUS_NAMES: Record<string, string> = {
    'PENDING': 'Oczekuje',
    'VERIFIED': 'Zweryfikowane',
    'REJECTED': 'Odrzucone'
}

export default function AdminReportsPage() {
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [categoryFilter, setCategoryFilter] = useState<string>("all")
    const [currentPage, setCurrentPage] = useState(1)
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
                page: String(currentPage - 1),
                size: String(pageSize),
                sort: 'createdAt',
                direction: 'desc'
            })
            
            if (statusFilter !== "all") {
                params.append('status', statusFilter)
            }
            if (categoryFilter !== "all") {
                params.append('category', categoryFilter)
            }

            const response = await fetch(`${API_BASE}?${params}`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data: PaginatedResponse = await response.json()
            setReports(data.content)
            setTotalPages(data.totalPages || 1)
            setTotalElements(data.totalElements)
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
    const filteredReports = reports.filter(report => {
        if (!search) return true
        const matchesSearch = report.title.toLowerCase().includes(search.toLowerCase()) ||
            report.description.toLowerCase().includes(search.toLowerCase())
        return matchesSearch
    })

    const handleDelete = async (id: string) => {
        if (confirm("Czy na pewno chcesz usunąć to zgłoszenie?")) {
            try {
                const response = await fetch(`${API_BASE}/${id}`, {
                    method: 'DELETE'
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
                const response = await fetch(`${API_BASE}/${editingReport.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(editingReport)
                })
                if (response.ok) {
                    fetchReports()
                    setEditingReport(null)
                } else {
                    alert("Nie udało się zaktualizować zgłoszenia")
                }
            } catch (err) {
                console.error("Update failed:", err)
                // Fallback to local update
                setReports(reports.map(r => r.id === editingReport.id ? editingReport : r))
                setEditingReport(null)
            }
        }
    }

    const handleStatusChange = async (id: string, newStatus: Report["status"]) => {
        try {
            const response = await fetch(`${API_BASE}/${id}?status=${newStatus}`, {
                method: 'PATCH'
            })
            if (response.ok) {
                // Update local state immediately for better UX
                setReports(reports.map(r => r.id === id ? { ...r, status: newStatus } : r))
            } else {
                alert("Nie udało się zmienić statusu")
            }
        } catch (err) {
            console.error("Status change failed:", err)
            // Fallback to local update
            setReports(reports.map(r => r.id === id ? { ...r, status: newStatus } : r))
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                    onClick={fetchReports}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Spróbuj ponownie
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Wszystkie zgłoszenia</h1>
                    <p className="text-zinc-400 text-sm mt-1">
                        Zarządzaj zgłoszeniami użytkowników ({totalElements} łącznie)
                    </p>
                </div>
                <button
                    onClick={fetchReports}
                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100"
                    title="Odśwież"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Szukaj zgłoszeń..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-zinc-500" />
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-700"
                    >
                        <option value="all">Wszystkie statusy</option>
                        <option value="PENDING">Oczekujące</option>
                        <option value="VERIFIED">Zweryfikowane</option>
                        <option value="REJECTED">Odrzucone</option>
                    </select>
                    <select
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-700"
                    >
                        <option value="all">Wszystkie kategorie</option>
                        {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                            <option key={key} value={key}>{name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Tytuł</TableCell>
                            <TableCell>Kategoria</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>AI Weryfikacja</TableCell>
                            <TableCell>Data</TableCell>
                            <TableCell>Akcje</TableCell>
                        </TableRow>
                    </TableHead>
                    <tbody>
                        {filteredReports.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    <p className="text-zinc-500">Brak zgłoszeń do wyświetlenia</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredReports.map((report) => (
                            <TableRow key={report.id} className="hover:bg-zinc-800/50">
                                <TableCell>
                                    <div>
                                        <p className="font-medium text-zinc-100">{report.title}</p>
                                        <p className="text-xs text-zinc-500 truncate max-w-[200px]">{report.description}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className="text-zinc-300 text-sm">
                                        {CATEGORY_NAMES[report.category] || report.category}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <select
                                        value={report.status}
                                        onChange={(e) => handleStatusChange(report.id, e.target.value as Report["status"])}
                                        className={`px-2 py-1 rounded text-xs font-medium ${STATUS_STYLES[report.status]} bg-transparent border-0 cursor-pointer`}
                                    >
                                        <option value="PENDING">Oczekuje</option>
                                        <option value="VERIFIED">Zweryfikowane</option>
                                        <option value="REJECTED">Odrzucone</option>
                                    </select>
                                </TableCell>
                                <TableCell>
                                    {report.aiFakeProbability !== undefined && (
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${report.aiIsFake ? 'bg-red-500' : 'bg-green-500'}`} />
                                            <span className={`text-xs ${report.aiIsFake ? 'text-red-400' : 'text-green-400'}`}>
                                                {report.aiIsFake ? 'Podejrzane' : 'OK'} ({Math.round(report.aiFakeProbability * 100)}%)
                                            </span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <span className="text-zinc-400 text-sm">
                                        {new Date(report.createdAt).toLocaleDateString('pl-PL')}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setViewingReport(report)}
                                            className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-100"
                                            title="Podgląd"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(report)}
                                            className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-blue-400"
                                            title="Edytuj"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(report.id)}
                                            className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-red-400"
                                            title="Usuń"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                        )}
                    </tbody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                    Strona {currentPage} z {totalPages || 1}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800"
                    >
                        <ChevronLeft className="w-4 h-4 text-zinc-400" />
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800"
                    >
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* View Modal */}
            {viewingReport && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-semibold text-zinc-100">{viewingReport.title}</h2>
                            <button onClick={() => setViewingReport(null)} className="p-1 hover:bg-zinc-800 rounded">
                                <X className="w-5 h-5 text-zinc-400" />
                            </button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-zinc-500">Opis:</span>
                                <p className="text-zinc-300 mt-1">{viewingReport.description}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-zinc-500">Kategoria:</span>
                                    <p className="text-zinc-300">{CATEGORY_NAMES[viewingReport.category]}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Status:</span>
                                    <p className={STATUS_STYLES[viewingReport.status].replace('bg-', 'text-').split(' ')[1]}>
                                        {STATUS_NAMES[viewingReport.status]}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Lokalizacja:</span>
                                    <p className="text-zinc-300">{viewingReport.latitude.toFixed(4)}, {viewingReport.longitude.toFixed(4)}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Data utworzenia:</span>
                                    <p className="text-zinc-300">{new Date(viewingReport.createdAt).toLocaleString('pl-PL')}</p>
                                </div>
                            </div>
                            {viewingReport.aiFakeProbability !== undefined && (
                                <div>
                                    <span className="text-zinc-500">Weryfikacja AI:</span>
                                    <p className={viewingReport.aiIsFake ? 'text-red-400' : 'text-green-400'}>
                                        {viewingReport.aiIsFake ? 'Podejrzane zgłoszenie' : 'Zgłoszenie wiarygodne'} 
                                        ({Math.round(viewingReport.aiFakeProbability * 100)}% prawdopodobieństwo fałszu)
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingReport && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-semibold text-zinc-100">Edytuj zgłoszenie</h2>
                            <button onClick={() => setEditingReport(null)} className="p-1 hover:bg-zinc-800 rounded">
                                <X className="w-5 h-5 text-zinc-400" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Tytuł</label>
                                <input
                                    type="text"
                                    value={editingReport.title}
                                    onChange={(e) => setEditingReport({ ...editingReport, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Opis</label>
                                <textarea
                                    value={editingReport.description}
                                    onChange={(e) => setEditingReport({ ...editingReport, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Kategoria</label>
                                <select
                                    value={editingReport.category}
                                    onChange={(e) => setEditingReport({ ...editingReport, category: e.target.value })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                                >
                                    {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                                        <option key={key} value={key}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Status</label>
                                <select
                                    value={editingReport.status}
                                    onChange={(e) => setEditingReport({ ...editingReport, status: e.target.value as Report["status"] })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                                >
                                    <option value="PENDING">Oczekuje</option>
                                    <option value="VERIFIED">Zweryfikowane</option>
                                    <option value="REJECTED">Odrzucone</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => setEditingReport(null)}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
                                >
                                    Anuluj
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
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
