"use client"

import Link from "next/link"
import { FileText, Users, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"

// Report interface for type safety
interface Report {
    id: string
    title: string
    category: string
    status: string
    createdAt: string
    aiIsFake?: boolean
    aiFakeProbability?: number
}

const CATEGORY_NAMES: Record<string, string> = {
    VANDALISM: "Wandalizm",
    INFRASTRUCTURE: "Infrastruktura",
    DANGEROUS_SITUATION: "Niebezpieczna sytuacja",
    TRAFFIC_ACCIDENT: "Wypadek drogowy",
    WASTE_ILLEGAL_DUMPING: "Nielegalne wysypiska",
    OTHER: "Inne"
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    PENDING: { bg: "bg-yellow-500/20", text: "text-yellow-400", icon: Clock },
    VERIFIED: { bg: "bg-green-500/20", text: "text-green-400", icon: CheckCircle },
    REJECTED: { bg: "bg-red-500/20", text: "text-red-400", icon: XCircle }
}

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalReports: 0,
        pendingReports: 0,
        verifiedReports: 0,
        rejectedReports: 0,
        totalUsers: 0,
        bannedUsers: 0,
        reportsToday: 0,
        reportsThisWeek: 0
    })
    const [recentReports, setRecentReports] = useState<Report[]>([])

    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem("access_token")
            if (!token) return

            try {
                const res = await fetch("/api/admin/stats", {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                if (res.ok) {
                    const data = await res.json()
                    setStats(data)
                }
            } catch (err) {
                console.error("Failed to fetch stats", err)
            }
        }

        const fetchRecentReports = async () => {
            const token = localStorage.getItem("access_token")
            if (!token) return

            try {
                // Fetch last 5 reports
                const res = await fetch("/api/admin/reports?page=0&size=5&sort=createdAt&direction=desc", {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    // Backend returns Page<Report>, so data.content is the array
                    if (data.content && Array.isArray(data.content)) {
                        setRecentReports(data.content)
                    }
                }
            } catch (err) {
                console.error("Failed to fetch recent reports", err)
            }
        }

        fetchStats()
        fetchRecentReports()
    }, [])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-100">Panel administratora</h1>
                <p className="mt-1 text-sm text-zinc-400">Przegląd systemu i ostatnie aktywności</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-500">Wszystkie zgłoszenia</p>
                            <p className="mt-1 text-2xl font-bold text-zinc-100">{stats.totalReports}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                            <FileText className="h-5 w-5 text-blue-400" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                        <TrendingUp className="h-3 w-3" />
                        <span>+{stats.reportsToday} dzisiaj</span>
                    </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-500">Oczekujące</p>
                            <p className="mt-1 text-2xl font-bold text-yellow-400">{stats.pendingReports}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
                            <Clock className="h-5 w-5 text-yellow-400" />
                        </div>
                    </div>
                    <Link
                        href="/admin/verification"
                        className="mt-2 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-300"
                    >
                        <span>Przejdź do weryfikacji</span>
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-500">Użytkownicy</p>
                            <p className="mt-1 text-2xl font-bold text-zinc-100">{stats.totalUsers}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                            <Users className="h-5 w-5 text-purple-400" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{stats.bannedUsers} zablokowanych</span>
                    </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-500">Zweryfikowane</p>
                            <p className="mt-1 text-2xl font-bold text-green-400">{stats.verifiedReports}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                            <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                        {stats.totalReports > 0 ? Math.round((stats.verifiedReports / stats.totalReports) * 100) : 0}% wszystkich zgłoszeń
                    </p>
                </div>
            </div>

            {/* Recent Reports */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900">
                <div className="flex items-center justify-between border-b border-zinc-800 p-4">
                    <h2 className="text-lg font-semibold text-zinc-100">Ostatnio dodane zgłoszenia</h2>
                    <Link
                        href="/admin/reports"
                        className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                    >
                        Zobacz wszystkie
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
                <div className="divide-y divide-zinc-800">
                    {recentReports.map((report) => {
                        const statusStyle = STATUS_STYLES[report.status] || STATUS_STYLES.PENDING
                        const StatusIcon = statusStyle.icon
                        return (
                            <div key={report.id} className="p-4 transition-colors hover:bg-zinc-800/50">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="truncate font-medium text-zinc-100">{report.title}</h3>
                                            {report.aiIsFake && (
                                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                                                    AI: Podejrzane
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-3">
                                            <span className="text-xs text-zinc-500">
                                                {CATEGORY_NAMES[report.category] || report.category}
                                            </span>
                                            <span className="text-xs text-zinc-600">•</span>
                                            <span className="text-xs text-zinc-500">
                                                {new Date(report.createdAt).toLocaleString("pl-PL", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-1.5 rounded px-2 py-1 ${statusStyle.bg}`}>
                                        <StatusIcon className={`h-3 w-3 ${statusStyle.text}`} />
                                        <span className={`text-xs font-medium ${statusStyle.text}`}>
                                            {report.status === "PENDING"
                                                ? "Oczekuje"
                                                : report.status === "VERIFIED"
                                                    ? "Zweryfikowane"
                                                    : "Odrzucone"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Link
                    href="/admin/verification"
                    className="group rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:bg-zinc-800/50"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
                            <Clock className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="font-medium text-zinc-100 group-hover:text-white">Weryfikacja zgłoszeń</h3>
                            <p className="text-xs text-zinc-500">{stats.pendingReports} oczekujących</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/admin/reports"
                    className="group rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:bg-zinc-800/50"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                            <FileText className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-medium text-zinc-100 group-hover:text-white">Wszystkie zgłoszenia</h3>
                            <p className="text-xs text-zinc-500">Przeglądaj i zarządzaj</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/admin/users"
                    className="group rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:bg-zinc-800/50"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                            <Users className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-medium text-zinc-100 group-hover:text-white">Użytkownicy</h3>
                            <p className="text-xs text-zinc-500">Zarządzaj kontami</p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    )
}
