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
    requiredRoles?: string[]
    adminOnly?: boolean
}

const navItems: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
    {
        href: "/admin/verification",
        label: "Weryfikacja",
        icon: CheckSquare,
        requiredPermissions: ["reports:validate", "*:*"],
        requiredRoles: ["ROLE_ADMIN", "ROLE_MODERATOR", "ROLE_VOLUNTEER"]
    },
    { href: "/admin/reports", label: "Zgłoszenia", icon: FileText, adminOnly: true },
    { href: "/admin/users", label: "Użytkownicy", icon: Users, adminOnly: true },
    { href: "/admin/stats", label: "Statystyki", icon: BarChart3, adminOnly: true }
]

export function AdminSidebar() {
    const pathname = usePathname()
    const [userPermissions, setUserPermissions] = useState<string[]>([])
    const [userRoles, setUserRoles] = useState<string[]>([])
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line
        setMounted(true)
        const token = localStorage.getItem("access_token")
        if (token) {
            const payload: JwtPayload | null = parseJwt(token)
            if (payload) {
                setUserPermissions(payload.permissions || [])
                setUserRoles(payload.roles || [])
            }
        }
    }, [])

    const isAdmin =
        userRoles.includes("ROLE_ADMIN") ||
        userPermissions.includes("PERM_*:*") ||
        userPermissions.includes("PERM_SYSTEM:ADMIN")

    // Check if user has required permission or role
    const hasAccess = (item: NavItem) => {
        // Admin-only items
        if (item.adminOnly) {
            return isAdmin
        }

        // Check roles first
        if (item.requiredRoles && item.requiredRoles.length > 0) {
            if (item.requiredRoles.some((role) => userRoles.includes(role))) {
                return true
            }
        }

        // Check permissions
        if (item.requiredPermissions && item.requiredPermissions.length > 0) {
            return item.requiredPermissions.some((requiredPerm) => {
                const jwtFormat = `PERM_${requiredPerm.toUpperCase()}`
                if (userPermissions.includes(jwtFormat)) return true
                if (userPermissions.includes("PERM_*:*")) return true
                const [resource] = requiredPerm.split(":")
                if (resource && userPermissions.includes(`PERM_${resource.toUpperCase()}:*`)) {
                    return true
                }
                return false
            })
        }

        return true
    }

    if (!mounted) return null

    return (
        <aside className="min-h-screen w-60 space-y-4 border-r border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 px-2 py-3">
                <Shield className="h-6 w-6 text-blue-500" />
                <span className="font-bold text-zinc-100">Admin Panel</span>
            </div>
            <nav className="flex flex-col space-y-1">
                {navItems
                    .filter((item) => hasAccess(item))
                    .map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                                    isActive
                                        ? "bg-blue-500/20 text-blue-400"
                                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="text-sm font-medium">{item.label}</span>
                            </Link>
                        )
                    })}
            </nav>
        </aside>
    )
}
