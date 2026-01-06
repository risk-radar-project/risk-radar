"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { PageTitle } from "@/components/shared/page-title"
import { SectionCard } from "@/components/shared/section-card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/ui/ux/empty-state"
import { Skeleton } from "@/components/ui/ux/skeleton"
import { Badge } from "@/components/ui/ux/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUserProfile, useLoginHistory } from "@/hooks/use-api"
import { requestPasswordReset, changeEmail } from "@/lib/api/user"
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
                    <div className="text-destructive text-sm">Nie udało się załadować profilu.</div>
                    <Button variant="outline" onClick={onRetry}>
                        Spróbuj ponownie
                    </Button>
                </div>
            </SectionCard>
        </>
    )
}

export default function ProfileContent() {
    const cardClass = "bg-[#1f1913] border-[#33281f] text-[#ede3d6] shadow-[0_18px_50px_-30px_rgba(0,0,0,0.8)] p-5 md:p-6"
    const labelMuted = "text-sm text-[#9c8876]"

    const { data: user, isLoading, isError, refetch } = useUserProfile()
    const { data: loginHistory } = useLoginHistory(user?.id)

    const queryClient = useQueryClient()
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
    const [emailStep, setEmailStep] = useState<1 | 2>(1)
    const [newEmail, setNewEmail] = useState("")
    const [confirmEmail, setConfirmEmail] = useState("")
    const [emailError, setEmailError] = useState("")

    const emailMutation = useMutation({
        mutationFn: async (email: string) => changeEmail(email),
        onSuccess: (response) => {
            if (response.error) {
                toast.error("Nie udało się zmienić adresu email")
            } else {
                toast.success("Adres email został zmieniony")
                resetEmailDialog()
                queryClient.invalidateQueries({ queryKey: ["user-profile"] })
            }
        },
        onError: () => {
            toast.error("Wystąpił błąd podczas zmiany adresu email")
        }
    })

    const handleEmailNextStep = () => {
        if (!newEmail.includes("@")) {
            setEmailError("Podaj poprawny adres email")
            return
        }
        if (newEmail === user?.email) {
            setEmailError("Nowy adres email musi być inny niż obecny")
            return
        }
        setEmailError("")
        setEmailStep(2)
    }

    const handleEmailSubmit = () => {
        if (newEmail !== confirmEmail) {
            setEmailError("Adresy email muszą być identyczne")
            return
        }
        setEmailError("")
        emailMutation.mutate(newEmail)
    }

    const resetEmailDialog = () => {
        setIsEmailDialogOpen(false)
        setTimeout(() => {
            setEmailStep(1)
            setNewEmail("")
            setConfirmEmail("")
            setEmailError("")
        }, 300)
    }

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
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-[#c2b3a3]">{user.email}</div>
                                <Button variant="outline" size="sm" onClick={() => setIsEmailDialogOpen(true)} className="h-7 text-xs border-[#3d3125] bg-[#2c231b] text-[#f6eedf] hover:bg-[#3d3125] hover:text-[#f6eedf]">
                                    Zmień
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className={labelMuted}>ID</div>
                            <div className="text-xs break-all text-[#8c7a6b]">{user.id}</div>
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
                                        <Badge
                                            key={role}
                                            className="border-[#3d3125] bg-[#2c231b] px-2.5 py-1 text-[#f6eedf]"
                                        >
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
                                        <Badge
                                            key={perm}
                                            className="border-[#3d3125] bg-[#211912] px-2 py-1 text-xs text-[#f6eedf]"
                                        >
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
                                Wyślij link do resetu hasła na adres powiązany z kontem. Skorzystaj z linku w wiadomości, aby
                                ustawić nowe hasło.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                onClick={() => passwordMutation.mutate()}
                                disabled={passwordMutation.isPending || !user.email}
                                className="border border-[#f5a52433] bg-[#d97706] text-[#120c07] hover:bg-[#f59e0b]"
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

            <Dialog open={isEmailDialogOpen} onOpenChange={resetEmailDialog}>
                <DialogContent className="bg-[#1f1913] border-[#33281f] text-[#ede3d6]">
                    <DialogHeader>
                        <DialogTitle>Zmiana adresu email</DialogTitle>
                        <DialogDescription className="text-[#9c8876]">
                            {emailStep === 1
                                ? "Wprowadź nowy adres email."
                                : "Potwierdź nowy adres email, wpisując go ponownie."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-[#c2b3a3]">
                                {emailStep === 1 ? "Nowy email" : "Potwierdź email"}
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={emailStep === 1 ? newEmail : confirmEmail}
                                onChange={(e) =>
                                    emailStep === 1 ? setNewEmail(e.target.value) : setConfirmEmail(e.target.value)
                                }
                                className="bg-[#120c07] border-[#3d3125] text-[#ede3d6]"
                                placeholder="jan.kowalski@example.com"
                            />
                            {emailError && <p className="text-sm text-red-400">{emailError}</p>}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={resetEmailDialog} className="text-[#c2b3a3] hover:bg-[#2c231b] hover:text-[#ede3d6]">
                            Anuluj
                        </Button>
                        {emailStep === 1 ? (
                            <Button onClick={handleEmailNextStep} className="bg-[#d97706] text-[#120c07] hover:bg-[#f59e0b]">
                                Dalej
                            </Button>
                        ) : (
                            <Button onClick={handleEmailSubmit} disabled={emailMutation.isPending} className="bg-[#d97706] text-[#120c07] hover:bg-[#f59e0b]">
                                {emailMutation.isPending ? "Zapisywanie..." : "Zatwierdź"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
