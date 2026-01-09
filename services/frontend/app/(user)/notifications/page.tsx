import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"
import { NotificationsListClient } from "./notifications-list-client"

export default function NotificationsPage() {
    return (
        <>
            <PageHeader>
                <PageTitle>Powiadomienia</PageTitle>
            </PageHeader>

            <SectionCard className="border-zinc-800 bg-zinc-900 text-zinc-100">
                <NotificationsListClient filter="all" />
            </SectionCard>
        </>
    )
}
