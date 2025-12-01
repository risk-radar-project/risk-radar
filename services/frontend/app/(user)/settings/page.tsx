import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
    return (
        <>
            <PageHeader>
                <PageTitle>Ustawienia konta</PageTitle>
            </PageHeader>

            <SectionCard>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label>Email</label>
                        <Input placeholder="placeholder@example.com" />
                    </div>

                    <Button>Zapisz zmiany</Button>
                </div>
            </SectionCard>
        </>
    )
}
