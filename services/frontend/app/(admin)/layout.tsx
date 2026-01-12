import type { ReactNode } from "react"
import { Breadcrumbs } from "@/components/ui/ux/breadcrumbs"
import { ClientAdminGuard } from "@/components/auth/client-admin-guard"

/**
 * Layout component for the admin section.
 * This component wraps all admin pages, providing a consistent layout and
 * protecting them with the `ClientAdminGuard`.
 * @param {object} props - The component props.
 * @param {ReactNode} props.children - The child components to be rendered within the layout.
 * @returns {JSX.Element} The admin layout component.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen bg-[#2a221a] text-[#e0dcd7]">
            <main className="flex-1 space-y-6 p-6">
                {/* ClientAdminGuard ensures that only users with admin privileges can access this section. */}
                <ClientAdminGuard>
                    <Breadcrumbs />
                    {children}
                </ClientAdminGuard>
            </main>
        </div>
    )
}
