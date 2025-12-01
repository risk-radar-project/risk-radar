import type { ReactNode } from "react"
import { PageContainer } from "@/components/shared/page-container"

export default function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <PageContainer>{children}</PageContainer>
    )
}
