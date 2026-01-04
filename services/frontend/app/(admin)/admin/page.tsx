"use client"

import Link from "next/link"
import { FileText, Users, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react"

// Mock stats - to be replaced with API call
const stats = {
    totalReports: 156,
    pendingReports: 12,
    verifiedReports: 132,
    rejectedReports: 12,
    totalUsers: 89,
    bannedUsers: 3,
    reportsToday: 8,
    reportsThisWeek: 42
}

// Mock recent reports - to be replaced with API call
const recentReports = [
    {
        id: "r1",
        title: "Dziura w jezdni na ul. Głównej",
        category: "INFRASTRUCTURE",
        status: "PENDING",
        createdAt: "2026-01-02T10:30:00",
        aiIsFake: false,
        aiFakeProbability: 0.05
    },
    {
        id: "r2",
        title: "Awaria sygnalizacji świetlnej",
        category: "INFRASTRUCTURE",
        status: "PENDING",
        createdAt: "2026-01-02T09:15:00",
        aiIsFake: false,
        aiFakeProbability: 0.12
    },
    {
        id: "r3",
        title: "Wandalizm w parku miejskim",
        category: "VANDALISM",
        status: "VERIFIED",
        createdAt: "2026-01-02T08:00:00",
        aiIsFake: false,
        aiFakeProbability: 0.08
    },
    {
        id: "r4",
        title: "Podejrzany raport UFO",
        category: "OTHER",
        status: "REJECTED",
        createdAt: "2026-01-02T07:30:00",
        aiIsFake: true,
        aiFakeProbability: 0.95
    },
    {
        id: "r5",
        title: "Nielegalne wysypisko śmieci",
        category: "WASTE_ILLEGAL_DUMPING",
        status: "PENDING",
        createdAt: "2026-01-01T23:45:00",
        aiIsFake: false,
        aiFakeProbability: 0.03
    },
]

const CATEGORY_NAMES: Record<string, string> = {
    'VANDALISM': 'Wandalizm',
    'INFRASTRUCTURE': 'Infrastruktura',
    'DANGEROUS_SITUATION': 'Niebezpieczna sytuacja',
    'TRAFFIC_ACCIDENT': 'Wypadek drogowy',
    'WASTE_ILLEGAL_DUMPING': 'Nielegalne wysypiska',
    'OTHER': 'Inne'
}

const STATUS_STYLES: Record<string, { bg: string, text: string, icon: React.ElementType }> = {
    'PENDING': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
    'VERIFIED': { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
    'REJECTED': { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle }
}

export default function AdminDashboard() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-100">Panel administratora</h1>
                <p className="text-zinc-400 text-sm mt-1">Przegląd systemu i ostatnie aktywności</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 text-sm">Wszystkie zgłoszenia</p>
                            <p className="text-2xl font-bold text-zinc-100 mt-1">{stats.totalReports}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
                        <TrendingUp className="w-3 h-3" />
                        <span>+{stats.reportsToday} dzisiaj</span>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 text-sm">Oczekujące</p>
                            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pendingReports}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-yellow-400" />
                        </div>
                    </div>
                    <Link href="/admin/verification" className="flex items-center gap-1 mt-2 text-xs text-zinc-400 hover:text-zinc-300">
                        <span>Przejdź do weryfikacji</span>
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 text-sm">Użytkownicy</p>
                            <p className="text-2xl font-bold text-zinc-100 mt-1">{stats.totalUsers}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-400" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{stats.bannedUsers} zablokowanych</span>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 text-sm">Zweryfikowane</p>
                            <p className="text-2xl font-bold text-green-400 mt-1">{stats.verifiedReports}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                        {Math.round((stats.verifiedReports / stats.totalReports) * 100)}% wszystkich zgłoszeń
                    </p>
                </div>
            </div>

            {/* Recent Reports */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-zinc-100">Ostatnio dodane zgłoszenia</h2>
                    <Link href="/admin/reports" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        Zobacz wszystkie
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
                <div className="divide-y divide-zinc-800">
                    {recentReports.map((report) => {
                        const statusStyle = STATUS_STYLES[report.status]
                        const StatusIcon = statusStyle.icon
                        return (
                            <div key={report.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-zinc-100 truncate">{report.title}</h3>
                                            {report.aiIsFake && (
                                                <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded font-medium">
                                                    AI: Podejrzane
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-zinc-500">
                                                {CATEGORY_NAMES[report.category] || report.category}
                                            </span>
                                            <span className="text-xs text-zinc-600">•</span>
                                            <span className="text-xs text-zinc-500">
                                                {new Date(report.createdAt).toLocaleString('pl-PL', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${statusStyle.bg}`}>
                                        <StatusIcon className={`w-3 h-3 ${statusStyle.text}`} />
                                        <span className={`text-xs font-medium ${statusStyle.text}`}>
                                            {report.status === 'PENDING' ? 'Oczekuje' : 
                                             report.status === 'VERIFIED' ? 'Zweryfikowane' : 'Odrzucone'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link 
                    href="/admin/verification"
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="font-medium text-zinc-100 group-hover:text-white">Weryfikacja zgłoszeń</h3>
                            <p className="text-xs text-zinc-500">{stats.pendingReports} oczekujących</p>
                        </div>
                    </div>
                </Link>

                <Link 
                    href="/admin/reports"
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-medium text-zinc-100 group-hover:text-white">Wszystkie zgłoszenia</h3>
                            <p className="text-xs text-zinc-500">Przeglądaj i zarządzaj</p>
                        </div>
                    </div>
                </Link>

                <Link 
                    href="/admin/users"
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-400" />
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
