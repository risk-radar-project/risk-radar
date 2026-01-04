"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, FileText, BarChart3, Shield, CheckSquare } from "lucide-react"

const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/verification", label: "Weryfikacja", icon: CheckSquare },
    { href: "/admin/reports", label: "Zgłoszenia", icon: FileText },
    { href: "/admin/users", label: "Użytkownicy", icon: Users },
    { href: "/admin/stats", label: "Statystyki", icon: BarChart3 },
]

export function AdminSidebar() {
    const pathname = usePathname()

    return (
        <aside className="w-60 border-r border-zinc-800 min-h-screen p-4 space-y-4 bg-zinc-950">
            <div className="flex items-center gap-2 px-2 py-3 border-b border-zinc-800 mb-4">
                <Shield className="w-6 h-6 text-blue-500" />
                <span className="font-bold text-zinc-100">Admin Panel</span>
            </div>
            <nav className="flex flex-col space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || 
                        (item.href !== "/admin" && pathname.startsWith(item.href))
                    const Icon = item.icon
                    return (
                        <Link 
                            key={item.href}
                            href={item.href} 
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                isActive 
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
