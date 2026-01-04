"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, FileText, BarChart3, Shield, CheckSquare } from "lucide-react"
import { useEffect, useState } from "react"
import { JwtPayload, parseJwt } from "@/lib/auth/jwt-utils"

interface NavItem {
    href: string
    label: string
    icon: React.ElementType
    requiredPermissions?: string[]
}

const navItems: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/verification", label: "Weryfikacja", icon: CheckSquare, requiredPermissions: ["reports:validate", "reports:*", "*:*"] },
    { href: "/admin/reports", label: "Zgłoszenia", icon: FileText, requiredPermissions: ["reports:edit", "reports:delete", "reports:*", "*:*"] },
    { href: "/admin/users", label: "Użytkownicy", icon: Users, requiredPermissions: ["users:view", "users:ban", "users:*", "*:*"] },
    { href: "/admin/stats", label: "Statystyki", icon: BarChart3, requiredPermissions: ["stats:view", "stats:*", "*:*"] },
]

export function AdminSidebar() {
    const pathname = usePathname()
    const [userPermissions, setUserPermissions] = useState<string[]>([])
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const token = localStorage.getItem("access_token")
        if (token) {
            const payload: JwtPayload | null = parseJwt(token)
            if (payload) {
                setUserPermissions(payload.permissions || [])
            }
        }
    }, [])

    // Check if user has required permission
    // Permissions in JWT are stored as "PERM_USERS:VIEW" (uppercase with PERM_ prefix)
    // We need to match against format like "users:view" or "users:*" or "*:*"
    const hasPermission = (requiredPermissions?: string[]) => {
        if (!requiredPermissions || requiredPermissions.length === 0) return true

        return requiredPermissions.some(requiredPerm => {
            // Convert required permission to JWT format
            const jwtFormat = `PERM_${requiredPerm.toUpperCase()}`

            // Check direct match
            if (userPermissions.includes(jwtFormat)) return true

            // Check for wildcard permissions
            // e.g., "PERM_*:*" grants everything
            if (userPermissions.includes('PERM_*:*')) return true

            // Check for resource wildcard
            // e.g., "PERM_USERS:*" grants all users permissions
            const [resource] = requiredPerm.split(':')
            if (resource && userPermissions.includes(`PERM_${resource.toUpperCase()}:*`)) {
                return true
            }

            return false
        })
    }

    if (!mounted) return null

    return (
        <aside className="w-60 border-r border-zinc-800 min-h-screen p-4 space-y-4 bg-zinc-950">
            <div className="flex items-center gap-2 px-2 py-3 border-b border-zinc-800 mb-4">
                <Shield className="w-6 h-6 text-blue-500" />
                <span className="font-bold text-zinc-100">Admin Panel</span>
            </div>
            <nav className="flex flex-col space-y-1">
                {navItems.filter(item => hasPermission(item.requiredPermissions)).map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== "/admin" && pathname.startsWith(item.href))
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>
        </aside>
    )
}
