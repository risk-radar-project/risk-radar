"use client"

import { useQuery } from "@tanstack/react-query"
import { getCurrentUser } from "@/lib/api/auth"
import { getLoginHistory } from "@/lib/api/audit"
import { getUserProfile } from "@/lib/api/user"
import { getMyReports } from "@/lib/api/reports"

// Fetch current user
export function useCurrentUser() {
    return useQuery({
        queryKey: ["current-user"],
        queryFn: async () => (await getCurrentUser()).data
    })
}

// User profile
export function useUserProfile() {
    return useQuery({
        queryKey: ["user-profile"],
        queryFn: async () => (await getUserProfile()).data
    })
}

// Login history for a given actorId
export function useLoginHistory(actorId?: string) {
    return useQuery({
        queryKey: ["login-history", actorId],
        enabled: Boolean(actorId),
        queryFn: async () => (await getLoginHistory(actorId as string, 10)).data
    })
}

// User reports
export function useMyReports() {
    return useQuery({
        queryKey: ["my-reports"],
        queryFn: async () => (await getMyReports()).data
    })
}
