import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"

export default function MyReportsPage() {
    return (
        <>
            <PageHeader>
                <PageTitle>Moje zgłoszenia</PageTitle>
            </PageHeader>

            <SectionCard>
                <div className="text-muted-foreground">Brak zgłoszeń (placeholder)</div>
            </SectionCard>
        </>
    )
}
