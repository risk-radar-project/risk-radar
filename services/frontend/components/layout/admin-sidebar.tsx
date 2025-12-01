"use client"

import Link from "next/link"

export function AdminSidebar() {
    return (
        <aside className="w-60 border-r border-zinc-800 min-h-screen p-4 space-y-4">
            <nav className="flex flex-col space-y-2 text-zinc-300">
                <Link href="/admin" className="hover:text-white">Dashboard</Link>
                <Link href="/admin/users" className="hover:text-white">Użytkownicy</Link>
                <Link href="/admin/reports" className="hover:text-white">Zgłoszenia</Link>
                <Link href="/admin/stats" className="hover:text-white">Statystyki</Link>
            </nav>
        </aside>
    )
}
