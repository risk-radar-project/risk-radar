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
    role: "user" | "admin" | "moderator"
    isBanned: boolean
    createdAt: string
    reportsCount: number
    lastActive?: string
}

<<<<<<< HEAD
=======
// Mock data - to be replaced with API call
const mockUsers: User[] = [
    {
        id: "u1",
        username: "jan.kowalski",
        email: "jan.kowalski@example.com",
        role: "user",
        isBanned: false,
        createdAt: "2025-11-15T10:30:00",
        reportsCount: 12,
        lastActive: "2026-01-02T08:45:00"
    },
    {
        id: "u2",
        username: "anna.nowak",
        email: "anna.nowak@example.com",
        role: "moderator",
        isBanned: false,
        createdAt: "2025-10-20T14:00:00",
        reportsCount: 45,
        lastActive: "2026-01-02T10:15:00"
    },
    {
        id: "u3",
        username: "spammer123",
        email: "spam@fake.com",
        role: "user",
        isBanned: true,
        createdAt: "2025-12-01T09:00:00",
        reportsCount: 156,
        lastActive: "2025-12-20T23:59:00"
    },
    {
        id: "u4",
        username: "piotr.wisniewski",
        email: "piotr.w@example.com",
        role: "user",
        isBanned: false,
        createdAt: "2025-09-10T11:30:00",
        reportsCount: 8,
        lastActive: "2026-01-01T19:30:00"
    },
    {
        id: "u5",
        username: "maria.zielinska",
        email: "maria.z@example.com",
        role: "user",
        isBanned: false,
        createdAt: "2025-08-05T08:00:00",
        reportsCount: 23,
        lastActive: "2026-01-02T07:00:00"
    },
    {
        id: "u6",
        username: "admin",
        email: "admin@riskradar.pl",
        role: "admin",
        isBanned: false,
        createdAt: "2025-01-01T00:00:00",
        reportsCount: 0,
        lastActive: "2026-01-02T11:00:00"
    },
    {
        id: "u7",
        username: "troll_user",
        email: "troll@test.com",
        role: "user",
        isBanned: true,
        createdAt: "2025-12-28T15:00:00",
        reportsCount: 89,
        lastActive: "2025-12-30T12:00:00"
    }
]

>>>>>>> main
const ROLE_STYLES: Record<string, string> = {
    user: "bg-zinc-700/50 text-zinc-300",
    moderator: "bg-blue-500/20 text-blue-400",
    admin: "bg-purple-500/20 text-purple-400"
}

const ROLE_NAMES: Record<string, string> = {
    user: "Użytkownik",
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

<<<<<<< HEAD
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
        if (roles.includes('moderator') || roles.includes('MODERATOR')) return 'moderator'
        return 'user'
    }

    // Filter users (Client side for now regarding Search, as backend search is limited)
    const displayedUsers = users.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase())
        const matchesRole = roleFilter === "all" || user.role === roleFilter
        const matchesStatus = statusFilter === "all" ||
=======
    // Filter users
    const filteredUsers = users.filter((user) => {
        const matchesSearch =
            user.username.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase())
        const matchesRole = roleFilter === "all" || user.role === roleFilter
        const matchesStatus =
            statusFilter === "all" ||
>>>>>>> main
            (statusFilter === "banned" && user.isBanned) ||
            (statusFilter === "active" && !user.isBanned)
        return matchesSearch && matchesRole && matchesStatus
    })

<<<<<<< HEAD
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
                alert('Wystąpił błąd podczas zmiany statusu.')
            }
        } catch (e) {
            console.error(e)
            alert('Błąd połączenia.')
        }
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        const token = localStorage.getItem('access_token')
        try {
            const res = await fetch(`/api/admin/users/${userId}/roles`, {
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
=======
    const totalPages = Math.ceil(filteredUsers.length / pageSize)
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const handleBanToggle = (id: string) => {
        const user = users.find((u) => u.id === id)
        if (!user) return

        const action = user.isBanned ? "odbanować" : "zbanować"
        if (confirm(`Czy na pewno chcesz ${action} użytkownika ${user.username}?`)) {
            // TODO: Call API to ban/unban user
            setUsers(users.map((u) => (u.id === id ? { ...u, isBanned: !u.isBanned } : u)))
>>>>>>> main
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-100">Użytkownicy</h1>
<<<<<<< HEAD
                <p className="text-zinc-400 text-sm mt-1">
                    Zarządzaj użytkownikami systemu
=======
                <p className="mt-1 text-sm text-zinc-400">
                    Zarządzaj użytkownikami systemu ({filteredUsers.length} wyników)
>>>>>>> main
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
<<<<<<< HEAD
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                    Ładowanie...
=======
                        {paginatedUsers.map((user) => (
                            <TableRow key={user.id} className="hover:bg-zinc-800/50">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700">
                                            <UserCircle className="h-5 w-5 text-zinc-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-zinc-100">{user.username}</p>
                                            <p className="text-xs text-zinc-500">{user.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`rounded px-2 py-1 text-xs font-medium ${ROLE_STYLES[user.role]}`}>
                                        {ROLE_NAMES[user.role]}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {user.isBanned ? (
                                        <span className="rounded bg-red-500/20 px-2 py-1 text-xs font-medium text-red-400">
                                            Zablokowany
                                        </span>
                                    ) : (
                                        <span className="rounded bg-green-500/20 px-2 py-1 text-xs font-medium text-green-400">
                                            Aktywny
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <span className="text-zinc-300">{user.reportsCount}</span>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm text-zinc-400">
                                        {user.lastActive
                                            ? new Date(user.lastActive).toLocaleDateString("pl-PL", {
                                                  day: "2-digit",
                                                  month: "2-digit",
                                                  hour: "2-digit",
                                                  minute: "2-digit"
                                              })
                                            : "-"}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setViewingUser(user)}
                                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                                            title="Podgląd"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        {user.role !== "admin" && (
                                            <button
                                                onClick={() => handleBanToggle(user.id)}
                                                className={`rounded p-1.5 hover:bg-zinc-700 ${
                                                    user.isBanned
                                                        ? "text-green-400 hover:text-green-300"
                                                        : "text-zinc-400 hover:text-red-400"
                                                }`}
                                                title={user.isBanned ? "Odbanuj" : "Zbanuj"}
                                            >
                                                {user.isBanned ? (
                                                    <ShieldCheck className="h-4 w-4" />
                                                ) : (
                                                    <Ban className="h-4 w-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
>>>>>>> main
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
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${ROLE_STYLES[user.role] || ROLE_STYLES['user']}`}>
                                            {ROLE_NAMES[user.role] || user.role}
                                        </span>
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
<<<<<<< HEAD
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800"
=======
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
>>>>>>> main
                    >
                        <ChevronLeft className="h-4 w-4 text-zinc-400" />
                    </button>
                    <button
<<<<<<< HEAD
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800"
=======
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
>>>>>>> main
                    >
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* View Modal */}
            {viewingUser && (
<<<<<<< HEAD
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full">
                        <div className="flex justify-between items-start mb-4">
=======
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="mx-4 w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                        <div className="mb-4 flex items-start justify-between">
>>>>>>> main
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
<<<<<<< HEAD
                                    <span className="text-zinc-500">ID użytkownika:</span>
                                    <p className="text-zinc-300 font-mono text-xs truncate" title={viewingUser.id}>{viewingUser.id}</p>
                                </div>
                            </div>

                            {viewingUser.role !== 'admin' && ( // Prevent banning admins
                                <div className="pt-4 border-t border-zinc-800 mt-4">
=======
                                    <span className="text-zinc-500">Ostatnia aktywność:</span>
                                    <p className="text-zinc-300">
                                        {viewingUser.lastActive
                                            ? new Date(viewingUser.lastActive).toLocaleString("pl-PL")
                                            : "-"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Liczba zgłoszeń:</span>
                                    <p className="text-zinc-300">{viewingUser.reportsCount}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">ID użytkownika:</span>
                                    <p className="font-mono text-xs text-zinc-300">{viewingUser.id}</p>
                                </div>
                            </div>

                            {viewingUser.role !== "admin" && (
                                <div className="border-t border-zinc-800 pt-4">
>>>>>>> main
                                    <button
                                        onClick={() => {
                                            handleBanToggle(viewingUser.id, viewingUser.username, viewingUser.isBanned)
                                        }}
<<<<<<< HEAD
                                        className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${viewingUser.isBanned
                                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                                : 'bg-red-600 hover:bg-red-500 text-white'
                                            }`}
=======
                                        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 ${
                                            viewingUser.isBanned
                                                ? "bg-green-600 text-white hover:bg-green-500"
                                                : "bg-red-600 text-white hover:bg-red-500"
                                        }`}
>>>>>>> main
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
