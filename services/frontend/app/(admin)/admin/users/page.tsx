"use client"

import { useState, useEffect } from "react"
import { Table } from "@/components/ui/table/table"
import { TableHead } from "@/components/ui/table/table-head"
import { TableRow } from "@/components/ui/table/table-row"
import { TableCell } from "@/components/ui/table/table-cell"
import { Search, Filter, ChevronLeft, ChevronRight, Ban, ShieldCheck, Eye, X, UserCircle } from "lucide-react"

interface User {
    id: string
    username: string
    email: string
    role: "user" | "volunteer" | "moderator" | "admin"
    isBanned: boolean
    createdAt: string
    reportsCount: number
    lastActive?: string
}


const ROLE_STYLES: Record<string, string> = {
    user: "bg-zinc-700/50 text-zinc-300",
    volunteer: "bg-green-500/20 text-green-400",
    moderator: "bg-blue-500/20 text-blue-400",
    admin: "bg-purple-500/20 text-purple-400"
}

const ROLE_NAMES: Record<string, string> = {
    user: "Użytkownik",
    volunteer: "Wolontariusz",
    moderator: "Moderator",
    admin: "Administrator"
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [roleFilter, setRoleFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [currentPage, setCurrentPage] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [viewingUser, setViewingUser] = useState<User | null>(null)
    const pageSize = 10

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const token = localStorage.getItem('access_token')
            if (!token) return

            const res = await fetch(`/api/admin/users?page=${currentPage}&size=${pageSize}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                // Backend returns Page<UserResponse>
                const mappedUsers = data.content.map((u: any) => ({
                    id: u.id,
                    username: u.username,
                    email: u.email,
                    role: getRoleFromList(u.roles),
                    isBanned: u.isBanned,
                    createdAt: u.createdAt,
                    reportsCount: 0,
                    lastActive: null
                }))
                setUsers(mappedUsers)
                setTotalPages(data.totalPages)
            }
        } catch (error) {
            console.error("Failed to fetch users", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [currentPage])

    function getRoleFromList(roles: string[]) {
        if (!roles) return 'user'
        if (roles.includes('admin') || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN')) return 'admin'
        if (roles.includes('moderator') || roles.includes('MODERATOR') || roles.includes('ROLE_MODERATOR')) return 'moderator'
        if (roles.includes('volunteer') || roles.includes('VOLUNTEER') || roles.includes('ROLE_VOLUNTEER')) return 'volunteer'
        return 'user'
    }

    // Filter users (Client side for now regarding Search, as backend search is limited)
    const displayedUsers = users.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase())
        const matchesRole = roleFilter === "all" || user.role === roleFilter
        const matchesStatus = statusFilter === "all" ||
            (statusFilter === "banned" && user.isBanned) ||
            (statusFilter === "active" && !user.isBanned)
        return matchesSearch && matchesRole && matchesStatus
    })

    const handleBanToggle = async (userId: string, username: string, isCurrentlyBanned: boolean) => {
        const action = isCurrentlyBanned ? "odbanować" : "zbanować"
        if (!confirm(`Czy na pewno chcesz ${action} użytkownika ${username}?`)) return

        const token = localStorage.getItem('access_token')
        if (!token) return

        try {
            let res
            if (isCurrentlyBanned) {
                res = await fetch(`/api/admin/users/${userId}/unban`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            } else {
                res = await fetch(`/api/admin/users/ban`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username })
                })
            }

            if (res.ok) {
                fetchUsers()
                if (viewingUser && viewingUser.id === userId) {
                    setViewingUser(prev => prev ? ({ ...prev, isBanned: !isCurrentlyBanned }) : null)
                }
            } else {
                const errData = await res.json().catch(() => ({ error: 'Unknown error' }))
                const errorMsg = errData.error || errData.message || `Błąd ${res.status}`
                alert(`Wystąpił błąd: ${errorMsg}`)
            }
        } catch (e) {
            console.error(e)
            alert('Błąd połączenia.')
        }
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        const token = localStorage.getItem('access_token')
        try {
            const res = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ roleName: newRole })
            })
            if (res.ok) {
                fetchUsers()
                if (viewingUser && viewingUser.id === userId) {
                    setViewingUser(prev => prev ? ({ ...prev, role: newRole as any }) : null)
                }
            } else {
                alert('Nie udało się zmienić roli')
            }
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-100">Użytkownicy</h1>
                <p className="text-zinc-400 text-sm mt-1">
                    Zarządzaj użytkownikami systemu
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Szukaj po nazwie lub email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pr-4 pl-10 text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-zinc-500" />
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-700 focus:outline-none"
                    >
                        <option value="all">Wszystkie role</option>
                        <option value="user">Użytkownicy</option>
                        <option value="volunteer">Wolontariusze</option>
                        <option value="moderator">Moderatorzy</option>
                        <option value="admin">Administratorzy</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-700 focus:outline-none"
                    >
                        <option value="all">Wszystkie statusy</option>
                        <option value="active">Aktywni</option>
                        <option value="banned">Zablokowani</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Użytkownik</TableCell>
                            <TableCell>Rola</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Data rejestracji</TableCell>
                            <TableCell>Akcje</TableCell>
                        </TableRow>
                    </TableHead>
                    <tbody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                    Ładowanie...
                                </TableCell>
                            </TableRow>
                        ) : displayedUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                    {users.length === 0 ? 'Brak użytkowników' : 'Brak wyników wyszukiwania'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayedUsers.map((user) => (
                                <TableRow key={user.id} className="hover:bg-zinc-800/50">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                                                <UserCircle className="w-5 h-5 text-zinc-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-zinc-100">{user.username}</p>
                                                <p className="text-xs text-zinc-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                            className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-600 ${ROLE_STYLES[user.role] || ROLE_STYLES['user']}`}
                                        >
                                            <option value="user" className="bg-zinc-800 text-zinc-300">Użytkownik</option>
                                            <option value="volunteer" className="bg-zinc-800 text-zinc-300">Wolontariusz</option>
                                            <option value="moderator" className="bg-zinc-800 text-zinc-300">Moderator</option>
                                            <option value="admin" className="bg-zinc-800 text-zinc-300">Administrator</option>
                                        </select>
                                    </TableCell>
                                    <TableCell>
                                        {user.isBanned ? (
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">
                                                Zablokowany
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                                                Aktywny
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-zinc-400 text-sm">
                                            {new Date(user.createdAt).toLocaleDateString('pl-PL')}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setViewingUser(user)}
                                                className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-100"
                                                title="Podgląd"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {user.role !== 'admin' && (
                                                <button
                                                    onClick={() => handleBanToggle(user.id, user.username, user.isBanned)}
                                                    className={`p-1.5 hover:bg-zinc-700 rounded ${user.isBanned
                                                        ? 'text-green-400 hover:text-green-300'
                                                        : 'text-zinc-400 hover:text-red-400'
                                                        }`}
                                                    title={user.isBanned ? "Odbanuj" : "Zbanuj"}
                                                >
                                                    {user.isBanned ? (
                                                        <ShieldCheck className="w-4 h-4" />
                                                    ) : (
                                                        <Ban className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}
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
                    Strona {currentPage + 1} z {totalPages || 1}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800"
                    >
                        <ChevronLeft className="h-4 w-4 text-zinc-400" />
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800"
                    >
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* View Modal */}
            {viewingUser && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700">
                                    <UserCircle className="h-8 w-8 text-zinc-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-zinc-100">{viewingUser.username}</h2>
                                    <p className="text-sm text-zinc-500">{viewingUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingUser(null)} className="rounded p-1 hover:bg-zinc-800">
                                <X className="h-5 w-5 text-zinc-400" />
                            </button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-zinc-500 block mb-1">Rola:</span>
                                    <select
                                        value={viewingUser.role}
                                        onChange={(e) => handleRoleChange(viewingUser.id, e.target.value)}
                                        className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded px-2 py-1 w-full focus:outline-none focus:border-zinc-600"
                                    >
                                        <option value="user">Użytkownik</option>
                                        <option value="volunteer">Wolontariusz</option>
                                        <option value="moderator">Moderator</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Status:</span>
                                    <p className={viewingUser.isBanned ? "text-red-400" : "text-green-400"}>
                                        {viewingUser.isBanned ? "Zablokowany" : "Aktywny"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Data rejestracji:</span>
                                    <p className="text-zinc-300">
                                        {new Date(viewingUser.createdAt).toLocaleDateString("pl-PL")}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">ID użytkownika:</span>
                                    <p className="text-zinc-300 font-mono text-xs truncate" title={viewingUser.id}>{viewingUser.id}</p>
                                </div>
                            </div>

                            {viewingUser.role !== 'admin' && ( // Prevent banning admins
                                <div className="pt-4 border-t border-zinc-800 mt-4">
                                    <button
                                        onClick={() => {
                                            handleBanToggle(viewingUser.id, viewingUser.username, viewingUser.isBanned)
                                        }}
                                        className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${viewingUser.isBanned
                                            ? 'bg-green-600 hover:bg-green-500 text-white'
                                            : 'bg-red-600 hover:bg-red-500 text-white'
                                            }`}
                                    >
                                        {viewingUser.isBanned ? (
                                            <>
                                                <ShieldCheck className="h-4 w-4" />
                                                Odbanuj użytkownika
                                            </>
                                        ) : (
                                            <>
                                                <Ban className="h-4 w-4" />
                                                Zbanuj użytkownika
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
