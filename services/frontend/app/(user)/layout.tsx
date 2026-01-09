import type { ReactNode } from "react"
import { PageContainer } from "@/components/shared/page-container"
import { ClientUserGuard } from "@/components/auth/client-user-guard"

export default function UserLayout({ children }: { children: ReactNode }) {
    return (
        <ClientUserGuard>
            <PageContainer>{children}</PageContainer>
        </ClientUserGuard>
    )
}
