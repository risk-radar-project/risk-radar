import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"
import { EmptyState } from "@/components/ui/ux"

export default function MapPage() {
    return (
        <>
            <PageHeader>
                <PageTitle>Mapa zgłoszeń</PageTitle>
            </PageHeader>

            <SectionCard>
                <EmptyState
                    title="Widok mapy w przygotowaniu"
                    description="Integracja z map-service dostarczy tutaj interaktywne warstwy i filtrowanie raportów."
                />
            </SectionCard>
        </>
    )
}
