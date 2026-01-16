"use client"

import { useState, useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
    Search,
    Filter,
    Wifi,
    WifiOff,
    ArrowUp,
    ArrowDown,
    ChevronLeft,
    ChevronRight,
    ShieldAlert,
    RefreshCcw,
    X
} from "lucide-react"

import { getAuditLogs } from "@/lib/api/audit"
import type { AuditLog, AuditLogFilters } from "@/lib/api/types"
import { Table } from "@/components/ui/table/table"
import { TableHead } from "@/components/ui/table/table-head"
import { TableHeader } from "@/components/ui/table/table-header"
import { TableRow } from "@/components/ui/table/table-row"
import { TableCell } from "@/components/ui/table/table-cell"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { EmptyState, Spinner } from "@/components/ui/ux"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const LOG_TYPES = ["ACTION", "SECURITY", "SYSTEM", "ERROR", "INFO"]
const STATUSES = ["success", "failure", "warning", "error"]
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250]

const SortableHeader = ({
    label,
    col,
    filters,
    onSort,
    disabled,
    className
}: {
    label: string
    col: string
    filters: AuditLogFilters
    onSort: (col: string) => void
    disabled?: boolean
    className?: string
}) => {
    const isSorted = filters.sort_by === col
    return (
        <TableHead
            className={cn(
                "transition-colors select-none",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-zinc-100",
                className
            )}
            onClick={() => !disabled && onSort(col)}
        >
            <div className="flex items-center gap-1">
                {label}
                {isSorted &&
                    (filters.order === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
            </div>
        </TableHead>
    )
}

export default function AuditPage() {
    // Data & State
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [isLive, setIsLive] = useState(false)
    const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set())
    const socketRef = useRef<Socket | null>(null)
    const lastRequestTime = useRef(0)

    // Filters matching the backend query params
    const [filters, setFilters] = useState<AuditLogFilters>({
        page: 1,
        limit: 50,
        service: "",
        action: "",
        log_type: "",
        status: "",
        actor_id: "",
        sort_by: "timestamp",
        order: "desc"
    })

    // Local state for debounced inputs
    const [searchService, setSearchService] = useState("")
    const [searchAction, setSearchAction] = useState("")
    const [jumpPage, setJumpPage] = useState("1")

    // Debounce effect for search inputs
    useEffect(() => {
        const handler = setTimeout(() => {
            setFilters((prev) => {
                // Only update if changed to avoid unnecessary re-fetches
                if (prev.service === searchService && prev.action === searchAction) return prev
                return { ...prev, service: searchService, action: searchAction, page: 1 }
            })
        }, 500)

        return () => clearTimeout(handler)
    }, [searchService, searchAction])

    // Pagination info from backend
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    })

    // Fetch logs whenever filters change
    useEffect(() => {
        if (isLive) return

        const fetchLogs = async () => {
            const requestId = Date.now()
            lastRequestTime.current = requestId
            setLoading(true)

            try {
                const { data, error } = await getAuditLogs(filters)

                // Only update if this is the latest request
                if (lastRequestTime.current === requestId) {
                    if (error) {
                        // Fix: Ensure description is a string/node, not an object
                        toast.error("Błąd pobierania logów", {
                            description:
                                typeof error === "object"
                                    ? (error as Error)?.message || JSON.stringify(error)
                                    : String(error)
                        })
                    } else {
                        setLogs(data.data)
                        setPagination(data.pagination)
                        setJumpPage(String(data.pagination.page))
                    }
                    setLoading(false)
                }
            } catch (err) {
                if (lastRequestTime.current === requestId) {
                    toast.error("Wystąpił błąd krytyczny")
                    console.error(err)
                    setLoading(false)
                }
            }
        }

        fetchLogs()
    }, [filters, isLive])

    // WebSocket logic - needs direct connection to backend (Next.js doesn't proxy WebSockets well)
    useEffect(() => {
        if (isLive) {
            const token = localStorage.getItem("access_token")
            // WebSocket needs to connect directly to the API Gateway
            // Use NEXT_PUBLIC_API_GATEWAY_URL for browser-side connections
            const gatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8090"

            socketRef.current = io(gatewayUrl, {
                path: "/api/audit/socket.io",
                transports: ["polling", "websocket"],
                auth: { token: token || "" },
                extraHeaders: { Authorization: token ? `Bearer ${token}` : "" },
                reconnectionDelay: 1000,
                reconnection: true
            })

            const socket = socketRef.current

            socket.on("connect", () => toast.success("Połączono z strumieniem logów"))
            socket.on("connect_error", (err) => {
                if (err.message === "xhr poll error" || err.message === "unauthorized") {
                    toast.error("Błąd połączenia live (401)")
                }
            })
            socket.on("new_log", (newLog: AuditLog) => {
                setLogs((prev) => [newLog, ...prev].slice(0, 100))
                // Mark this log as new for animation
                setNewLogIds((prev) => new Set(prev).add(newLog.id))
                // Remove animation after 2 seconds
                setTimeout(() => {
                    setNewLogIds((prev) => {
                        const updated = new Set(prev)
                        updated.delete(newLog.id)
                        return updated
                    })
                }, 2000)
            })
            socket.emit("subscribe", { service: "*", log_type: "*" }) // Subscribe all

            return () => {
                socket.disconnect()
                socketRef.current = null
            }
        } else {
            if (socketRef.current) {
                socketRef.current.disconnect()
                socketRef.current = null
            }
        }
    }, [isLive])

    // Handlers
    const handleSort = (column: string) => {
        if (isLive) return // Disable sorting in live mode
        setFilters((prev) => {
            const isSameColumn = prev.sort_by === column
            const newOrder = isSameColumn && prev.order === "desc" ? "asc" : "desc"
            return { ...prev, sort_by: column, order: newOrder, page: 1 }
        })
    }

    const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
    }

    const clearFilters = () => {
        setSearchService("")
        setSearchAction("")
        setFilters({
            page: 1,
            limit: 50,
            service: "",
            action: "",
            log_type: "",
            status: "",
            actor_id: "",
            sort_by: "timestamp",
            order: "desc"
        })
    }

    const handlePageJump = (e: React.FormEvent) => {
        e.preventDefault()
        const page = parseInt(jumpPage)
        if (!isNaN(page) && page >= 1 && page <= pagination.totalPages) {
            setFilters((prev) => ({ ...prev, page }))
        } else {
            setJumpPage(String(pagination.page))
            toast.error(`Strona musi być liczbą z zakresu 1-${pagination.totalPages}`)
        }
    }

    // Styling Helpers
    const getStatusColor = (status: string) => {
        switch (status) {
            case "success":
                return "bg-green-500/20 text-green-400"
            case "failure":
            case "error":
                return "bg-red-500/20 text-red-400"
            case "warning":
                return "bg-yellow-500/20 text-yellow-400"
            default:
                return "bg-zinc-700/50 text-zinc-300"
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case "SECURITY":
                return "text-red-400 border-red-500/50"
            case "ERROR":
                return "text-orange-400 border-orange-500/50"
            case "ACTION":
                return "text-blue-400 border-blue-500/50"
            default:
                return "text-zinc-400 border-zinc-700"
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Dziennik Zdarzeń</h1>
                    <p className="mt-1 text-sm text-zinc-400">Monitorowanie aktywności systemu i użytkowników</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isLive ? "destructive" : "outline"}
                        onClick={() => setIsLive(!isLive)}
                        className={cn(
                            "gap-2 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800",
                            isLive && "border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/30"
                        )}
                        size="sm"
                    >
                        {isLive ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                        {isLive ? "Stop Live" : "Go Live"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters((prev) => ({ ...prev }))}
                        disabled={isLive || loading}
                        className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                    >
                        <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4">
                <div className="relative min-w-[140px] flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Szukaj serwisu..."
                        value={searchService}
                        onChange={(e) => setSearchService(e.target.value)}
                        disabled={isLive}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pr-4 pl-10 text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none disabled:opacity-50"
                    />
                </div>
                <div className="relative min-w-[140px] flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Szukaj akcji..."
                        value={searchAction}
                        onChange={(e) => setSearchAction(e.target.value)}
                        disabled={isLive}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pr-4 pl-10 text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none disabled:opacity-50"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Filter className="hidden h-4 w-4 text-zinc-500 sm:block" />

                    <select
                        value={filters.log_type || ""}
                        onChange={(e) => handleFilterChange("log_type", e.target.value)}
                        disabled={isLive}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-700 focus:outline-none disabled:opacity-50"
                    >
                        <option value="">Wszystkie typy</option>
                        {LOG_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>

                    <select
                        value={filters.status || ""}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                        disabled={isLive}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-700 focus:outline-none disabled:opacity-50"
                    >
                        <option value="">Wszystkie statusy</option>
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>

                    <select
                        value={filters.limit}
                        onChange={(e) => handleFilterChange("limit", e.target.value)}
                        disabled={isLive}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-700 focus:outline-none disabled:opacity-50"
                    >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                                {size} na stronę
                            </option>
                        ))}
                    </select>

                    {(filters.service || filters.action || filters.log_type || filters.status) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            disabled={isLive}
                            className="text-zinc-400 hover:text-zinc-100"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Table Area */}
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                <Table>
                    <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-transparent">
                            <SortableHeader
                                label="Czas"
                                col="timestamp"
                                className="w-[180px] pl-4"
                                filters={filters}
                                onSort={handleSort}
                                disabled={isLive}
                            />
                            <SortableHeader
                                label="Typ"
                                col="log_type"
                                filters={filters}
                                onSort={handleSort}
                                disabled={isLive}
                            />
                            <SortableHeader
                                label="Serwis"
                                col="service"
                                filters={filters}
                                onSort={handleSort}
                                disabled={isLive}
                            />
                            <SortableHeader
                                label="Akcja"
                                col="action"
                                filters={filters}
                                onSort={handleSort}
                                disabled={isLive}
                            />
                            <TableHead className="text-zinc-400">Aktor</TableHead>
                            <SortableHeader
                                label="Status"
                                col="status"
                                filters={filters}
                                onSort={handleSort}
                                disabled={isLive}
                            />
                            <TableHead className="pr-4 text-right text-zinc-400">Detale</TableHead>
                        </TableRow>
                    </TableHeader>
                    <tbody>
                        {loading && logs.length === 0 ? (
                            <TableRow className="border-zinc-800">
                                <TableCell colSpan={7} className="h-32 text-center">
                                    <Spinner className="mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow className="border-zinc-800">
                                <TableCell colSpan={7} className="h-64 text-center">
                                    <EmptyState
                                        title="Brak logów"
                                        description="Nie znaleziono zdarzeń pasujących do filtrów."
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log, idx) => {
                                const isNewLog = newLogIds.has(log.id)
                                return (
                                    <TableRow
                                        key={log.id || `log-${idx}`}
                                        className={cn(
                                            "border-zinc-800 transition-colors hover:bg-zinc-800/50",
                                            isNewLog && "animate-pulse border-blue-500/50 bg-blue-900/30"
                                        )}
                                    >
                                        <TableCell className="pl-4 font-mono text-xs whitespace-nowrap text-zinc-400">
                                            {log.timestamp
                                                ? format(new Date(log.timestamp), "dd MMM HH:mm:ss", { locale: pl })
                                                : "-"}
                                        </TableCell>
                                        <TableCell>
                                            <div
                                                className={cn(
                                                    "inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold",
                                                    getTypeColor(log.log_type)
                                                )}
                                            >
                                                {log.log_type}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm font-medium text-zinc-200">{log.service}</TableCell>
                                        <TableCell className="text-xs text-zinc-400">{log.action}</TableCell>
                                        <TableCell className="text-xs text-zinc-300">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{log.actor.type}</span>
                                                <span
                                                    className="max-w-[120px] truncate text-[10px] text-zinc-500"
                                                    title={log.actor.id}
                                                >
                                                    {log.actor.id}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={cn(
                                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                                    getStatusColor(log.status)
                                                )}
                                            >
                                                {log.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="pr-4 text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                                    >
                                                        <ShieldAlert className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-h-[80vh] overflow-y-auto border-zinc-800 bg-zinc-900 text-zinc-100">
                                                    <DialogHeader>
                                                        <DialogTitle>Szczegóły zdarzenia</DialogTitle>
                                                        <DialogDescription className="font-mono text-xs text-zinc-400">
                                                            {log.id}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div className="rounded bg-zinc-800/50 p-2">
                                                                <span className="mb-1 block text-xs tracking-wider text-zinc-500 uppercase">
                                                                    Serwis
                                                                </span>
                                                                {log.service}
                                                            </div>
                                                            <div className="rounded bg-zinc-800/50 p-2">
                                                                <span className="mb-1 block text-xs tracking-wider text-zinc-500 uppercase">
                                                                    Akcja
                                                                </span>
                                                                {log.action}
                                                            </div>
                                                            <div className="rounded bg-zinc-800/50 p-2">
                                                                <span className="mb-1 block text-xs tracking-wider text-zinc-500 uppercase">
                                                                    Aktor
                                                                </span>
                                                                {log.actor.type}{" "}
                                                                <span className="block text-xs text-zinc-500">
                                                                    {log.actor.id}
                                                                </span>
                                                            </div>
                                                            <div className="rounded bg-zinc-800/50 p-2">
                                                                <span className="mb-1 block text-xs tracking-wider text-zinc-500 uppercase">
                                                                    Adres IP
                                                                </span>
                                                                {log.actor.ip || "Brak"}
                                                            </div>
                                                        </div>
                                                        {log.metadata && (
                                                            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm">
                                                                <span className="mb-2 block text-xs font-semibold text-zinc-500 uppercase">
                                                                    Metadata
                                                                </span>
                                                                <pre className="font-mono text-xs whitespace-pre-wrap text-zinc-300">
                                                                    {JSON.stringify(log.metadata, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </tbody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {!isLive && logs.length > 0 && (
                <div className="flex flex-col items-center justify-between gap-4 text-sm text-zinc-400 sm:flex-row">
                    <div className="flex items-center gap-4">
                        <div>
                            Strona <span className="font-medium text-zinc-200">{pagination.page}</span> z{" "}
                            <span className="font-medium text-zinc-200">{pagination.totalPages}</span>
                            <span className="ml-1 text-zinc-500">({pagination.total} wpisów)</span>
                        </div>

                        <form onSubmit={handlePageJump} className="flex items-center gap-2">
                            <span className="text-zinc-500">Skocz do:</span>
                            <input
                                type="number"
                                min={1}
                                max={pagination.totalPages}
                                value={jumpPage}
                                onChange={(e) => setJumpPage(e.target.value)}
                                className="w-16 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-center text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                            />
                        </form>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 border-zinc-800 bg-zinc-900 p-0 text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
                            onClick={() => setFilters((prev) => ({ ...prev, page: pagination.page - 1 }))}
                            disabled={!pagination.hasPrev || loading}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 border-zinc-800 bg-zinc-900 p-0 text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
                            onClick={() => setFilters((prev) => ({ ...prev, page: pagination.page + 1 }))}
                            disabled={!pagination.hasNext || loading}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
