"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageTitle } from "@/components/shared/page-title";
import { SectionCard } from "@/components/shared/section-card";
import { parseJwt, type JwtPayload } from "@/lib/auth/jwt-utils";

export default function ProfilePage() {
    const [user, setUser] = useState<JwtPayload | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (token) {
            const decoded = parseJwt(token);
            setUser(decoded);
        }
        setLoading(false);
    }, []);

    if (loading) {
        return (
            <>
                <PageHeader>
                    <PageTitle>Profil użytkownika</PageTitle>
                </PageHeader>
                <SectionCard>
                    <div className="text-[#baab9c]">Ładowanie...</div>
                </SectionCard>
            </>
        );
    }

    if (!user) {
        return (
            <>
                <PageHeader>
                    <PageTitle>Profil użytkownika</PageTitle>
                </PageHeader>
                <SectionCard>
                    <div className="text-red-500">Nie zalogowano. Przekierowanie...</div>
                </SectionCard>
            </>
        );
    }

    return (
        <>
            <PageHeader>
                <PageTitle>Profil użytkownika</PageTitle>
            </PageHeader>

            <SectionCard>
                <div className="space-y-4">
                    <div>
                        <strong className="text-[#e0dcd7]">Nazwa użytkownika:</strong>
                        <span className="ml-2 text-[#baab9c]">
                            {user.username || user.sub || 'Brak danych'}
                        </span>
                    </div>
                    <div>
                        <strong className="text-[#e0dcd7]">Email:</strong>
                        <span className="ml-2 text-[#baab9c]">
                            {user.email || 'Brak danych'}
                        </span>
                    </div>
                    <div>
                        <strong className="text-[#e0dcd7]">ID użytkownika:</strong>
                        <span className="ml-2 text-[#baab9c] text-xs">
                            {user.userId || 'Brak danych'}
                        </span>
                    </div>
                    <div>
                        <strong className="text-[#e0dcd7]">Role:</strong>
                        <div className="ml-2 mt-1 flex flex-wrap gap-2">
                            {user.roles && user.roles.length > 0 ? (
                                user.roles.map((role, index) => (
                                    <span key={index} className="px-3 py-1 bg-[#d97706]/20 text-[#d97706] rounded-full text-sm">
                                        {role}
                                    </span>
                                ))
                            ) : (
                                <span className="text-[#baab9c]">Brak przypisanych ról</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <strong className="text-[#e0dcd7]">Uprawnienia:</strong>
                        <div className="ml-2 mt-1 flex flex-wrap gap-2">
                            {user.permissions && user.permissions.length > 0 ? (
                                user.permissions.map((perm, index) => (
                                    <span key={index} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                                        {perm}
                                    </span>
                                ))
                            ) : (
                                <span className="text-[#baab9c]">Brak przypisanych uprawnień</span>
                            )}
                        </div>
                    </div>
                </div>
            </SectionCard>
        </>
    );
}
