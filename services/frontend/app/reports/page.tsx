import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"
import { Skeleton } from "@/components/ui/ux"

export default function ReportsListingPage() {
    return (
        <>
            <PageHeader>
                <PageTitle>Przegląd zgłoszeń</PageTitle>
            </PageHeader>

            <SectionCard>
                <div className="space-y-4">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="space-y-2">
                            <Skeleton className="h-5 w-1/3" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                    ))}
                    <p className="text-sm text-zinc-500">
                        Widok zostanie zasilony danymi z report-service, gdy backend będzie gotowy.
                    </p>
                </div>
            </SectionCard>
        </>
    )
}
