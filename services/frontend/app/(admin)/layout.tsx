import type { ReactNode } from "react"
import { AdminSidebar } from "@/components/layout/admin-sidebar"

export default async function AdminLayout({ children }: { children: ReactNode }) {
    // TODO: Add authentication check later
    // const allowed = await requireAdmin()
    // if (!allowed) {
    //     return <div className="p-10 text-red-400">Brak uprawnień (placeholder)</div>
    // }

    return (
        <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
            <AdminSidebar />
            <main className="flex-1 space-y-6 p-6">{children}</main>
        </div>
    )
}
