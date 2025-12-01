import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"

export default function ProfilePage() {
    return (
        <>
            <PageHeader>
                <PageTitle>Profil użytkownika</PageTitle>
            </PageHeader>

            <SectionCard>
                <div className="space-y-2">
                    <div><strong>Nazwa:</strong> placeholder_user</div>
                    <div><strong>Email:</strong> placeholder@example.com</div>
                    <div><strong>Rola:</strong> user</div>
                </div>
            </SectionCard>
        </>
    )
}
