"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, FileText, BarChart3, Shield, CheckSquare } from "lucide-react"

const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/verification", label: "Weryfikacja", icon: CheckSquare },
    { href: "/admin/reports", label: "Zgłoszenia", icon: FileText },
    { href: "/admin/users", label: "Użytkownicy", icon: Users },
    { href: "/admin/stats", label: "Statystyki", icon: BarChart3 }
]

export function AdminSidebar() {
    const pathname = usePathname()

    return (
        <aside className="min-h-screen w-60 space-y-4 border-r border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 px-2 py-3">
                <Shield className="h-6 w-6 text-blue-500" />
                <span className="font-bold text-zinc-100">Admin Panel</span>
            </div>
            <nav className="flex flex-col space-y-1">
                {navItems.map((item) => {
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
