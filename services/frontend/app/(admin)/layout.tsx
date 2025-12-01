import type { ReactNode } from "react"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { requireAdmin } from "@/lib/auth/guards/require-admin"

export default async function AdminLayout({ children }: { children: ReactNode }) {
    const allowed = await requireAdmin()

    if (!allowed) {
        return <div className="p-10 text-red-400">Brak uprawnień (placeholder)</div>
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
            <AdminSidebar />
            <main className="flex-1 p-6 space-y-6">
                {children}
            </main>
        </div>
    )
}
