import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"
import { MyReportsClient } from "./my-reports-client"

export default function MyReportsPage() {
    return (
        <>
            <PageHeader>
                <PageTitle>Moje zgłoszenia</PageTitle>
            </PageHeader>

            <SectionCard className="border-zinc-800 bg-zinc-900 text-zinc-100">
                <MyReportsClient />
            </SectionCard>
        </>
    )
}
