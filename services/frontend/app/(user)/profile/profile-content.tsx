"use client"

import { useMutation } from "@tanstack/react-query"

import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/ui/ux/empty-state"
import { Skeleton } from "@/components/ui/ux/skeleton"
import { Badge } from "@/components/ui/ux/badge"
import { useUserProfile, useLoginHistory } from "@/hooks/use-api"
import { requestPasswordReset } from "@/lib/api/user"
import { formatDistanceToNow } from "date-fns"
import { pl } from "date-fns/locale"

function ProfileSkeleton() {
    return (
        <>
            <PageHeader>
                <PageTitle>Profil użytkownika</PageTitle>
            </PageHeader>

            <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard>
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <div className="flex gap-2">
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-6 w-20" />
                        </div>
                    </div>
                </SectionCard>

                <SectionCard>
                    <div className="space-y-3">
                        <Skeleton className="h-5 w-52" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-28" />
                    </div>
                </SectionCard>

                <SectionCard>
                    <div className="space-y-3">
                        <Skeleton className="h-5 w-56" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </SectionCard>
            </div>
        </>
    )
}

function ProfileError({ onRetry }: { onRetry: () => void }) {
    return (
        <>
            <PageHeader>
                <PageTitle>Profil użytkownika</PageTitle>
            </PageHeader>

            <SectionCard>
                <div className="space-y-3">
                    <div className="text-sm text-destructive">Nie udało się załadować profilu.</div>
                    <Button variant="outline" onClick={onRetry}>
                        Spróbuj ponownie
                    </Button>
                </div>
            </SectionCard>
        </>
    )
}

export default function ProfileContent() {
    const cardClass =
        "bg-[#1f1913] border-[#33281f] text-[#ede3d6] shadow-[0_18px_50px_-30px_rgba(0,0,0,0.8)] p-5 md:p-6"
    const labelMuted = "text-sm text-[#9c8876]"

    const { data: user, isLoading, isError, refetch } = useUserProfile()
    const { data: loginHistory } = useLoginHistory(user?.id)

    const passwordMutation = useMutation({
        mutationFn: async () => {
            if (!user?.email) {
                throw new Error("Brak adresu email użytkownika")
            }
            return requestPasswordReset(user.email)
        }
    })

    if (isLoading) {
        return <ProfileSkeleton />
    }

    if (isError) {
        return <ProfileError onRetry={refetch} />
    }

    if (!user) {
        return (
            <>
                <PageHeader>
                    <PageTitle>Twój profil</PageTitle>
                </PageHeader>
                <SectionCard>
                    <EmptyState title="Brak danych" description="Nie znaleziono informacji o użytkowniku." />
                </SectionCard>
            </>
        )
    }

    return (
        <div className="mx-auto max-w-5xl px-4 pb-12 lg:px-8">
            <PageHeader>
                <PageTitle>Twój profil</PageTitle>
            </PageHeader>

            <div className="grid gap-5 lg:grid-cols-3">
                <SectionCard className={cardClass}>
                    <div className="space-y-3">
                        <div className="text-base font-semibold text-[#f6eedf]">Dane konta</div>
                        <div className="space-y-1">
                            <div className={labelMuted}>Nazwa użytkownika</div>
                            <div className="text-xl font-semibold tracking-tight text-[#f6eedf]">{user.username}</div>
                        </div>
                        <div className="space-y-1">
                            <div className={labelMuted}>Email</div>
                            <div className="text-sm text-[#c2b3a3]">{user.email}</div>
                        </div>
                        <div className="space-y-1">
                            <div className={labelMuted}>ID</div>
                            <div className="text-xs text-[#8c7a6b] break-all">{user.id}</div>
                        </div>
                        <Separator className="border-[#31261d]" />
                        <div className="space-y-1">
                            <div className={labelMuted}>Ostatnie logowania</div>
                            {loginHistory && loginHistory.length ? (
                                <div className="space-y-2 text-sm text-[#c2b3a3]">
                                    {loginHistory.slice(0, 5).map((log) => (
                                        <div key={log.id ?? log.timestamp} className="flex flex-col">
                                            <span>{log.actor.ip ?? "(brak IP)"}</span>
                                            <span className="text-xs text-[#8c7a6b]">
                                                {log.timestamp
                                                    ? formatDistanceToNow(new Date(log.timestamp), {
                                                          addSuffix: true,
                                                          locale: pl
                                                      })
                                                    : ""}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-[#8c7a6b]">Brak historii logowań.</div>
                            )}
                        </div>
                    </div>
                </SectionCard>

                <SectionCard className={cardClass}>
                    <div className="space-y-3">
                        <div className="text-base font-semibold text-[#f6eedf]">Role i uprawnienia</div>
                        <div className="space-y-2">
                            <div className={labelMuted}>Role</div>
                            {user.roles.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {user.roles.map((role) => (
                                        <Badge key={role} className="bg-[#2c231b] text-[#f6eedf] border-[#3d3125] px-2.5 py-1">
                                            {role}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-[#8c7a6b]">Brak przypisanych ról.</div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className={labelMuted}>Uprawnienia</div>
                            {user.permissions && user.permissions.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {user.permissions.map((perm) => (
                                        <Badge key={perm} className="bg-[#211912] text-[#f6eedf] border-[#3d3125] px-2 py-1 text-xs">
                                            {perm}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-[#8c7a6b]">Brak dodatkowych uprawnień.</div>
                            )}
                        </div>
                    </div>
                </SectionCard>

                <SectionCard className={cardClass}>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <div className="text-base font-semibold text-[#f6eedf]">Zmień hasło</div>
                            <p className={labelMuted}>
                                Wyślij link do resetu hasła na adres powiązany z kontem. Skorzystaj z linku w wiadomości,
                                aby ustawić nowe hasło.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                onClick={() => passwordMutation.mutate()}
                                disabled={passwordMutation.isPending || !user.email}
                                className="bg-[#d97706] text-[#120c07] hover:bg-[#f59e0b] border border-[#f5a52433]"
                            >
                                {passwordMutation.isPending ? "Wysyłanie..." : "Wyślij link resetujący"}
                            </Button>
                            {passwordMutation.isSuccess && (
                                <span className="text-sm text-emerald-300">Sprawdź skrzynkę pocztową.</span>
                            )}
                            {passwordMutation.isError && (
                                <span className="text-sm text-red-300">Nie udało się wysłać linku.</span>
                            )}
                            {!user.email && <span className="text-sm text-red-300">Brak adresu email.</span>}
                        </div>
                    </div>
                </SectionCard>
            </div>
        </div>
    )
}
