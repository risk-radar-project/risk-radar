import type { ReactNode } from "react"
import { PageContainer } from "@/components/shared/page-container"

export default function UserLayout({ children }: { children: ReactNode }) {
    return <PageContainer>{children}</PageContainer>
}
