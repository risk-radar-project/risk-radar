import type { ReactNode } from "react"
import { Breadcrumbs } from "@/components/ui/ux/breadcrumbs"
import { ClientAdminGuard } from "@/components/auth/client-admin-guard"

export default async function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen bg-[#2a221a] text-[#e0dcd7]">
            <main className="flex-1 space-y-6 p-6">
                <ClientAdminGuard>
                    <Breadcrumbs />
                    {children}
                </ClientAdminGuard>
            </main>
        </div>
    )
}
