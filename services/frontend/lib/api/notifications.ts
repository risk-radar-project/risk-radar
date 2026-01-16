import type { ApiResponse } from "./types"
import { getFreshAccessToken } from "@/lib/auth/auth-service"

export type Notification = {
    id: string
    eventId: string
    eventType: string
    title: string
    body: string
    isRead: boolean
    createdAt: string
    metadata?: Record<string, unknown>
}

export type NotificationsListResponse = {
    data: Notification[]
    pagination?: {
        page: number
        limit: number
        total: number
    }
}

export type GetNotificationsParams = {
    page?: number
    limit?: number
    isRead?: boolean
}

// Fetch paginated notifications for current user
export async function getNotifications(
    params: GetNotificationsParams = {}
): Promise<ApiResponse<NotificationsListResponse>> {
    const token = await getFreshAccessToken()

    if (!token) {
        throw new Error("Nie jesteś zalogowany")
    }

    const queryParams = new URLSearchParams()
    if (params.page !== undefined) queryParams.set("page", params.page.toString())
    if (params.limit !== undefined) queryParams.set("limit", params.limit.toString())
    if (params.isRead !== undefined) queryParams.set("isRead", params.isRead.toString())

    const response = await fetch(`/api/notifications?${queryParams.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się pobrać powiadomień"
        try {
            const body = await response.json()
            // gateway error shape: { error: { code, message }, success: false }
            errorMessage = body?.error?.message ?? body.error ?? body.message ?? errorMessage
        } catch {
            // ignore parse errors
        }
        throw new Error(errorMessage)
    }

    const json = await response.json()
    return {
        data: json
    }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string): Promise<ApiResponse<null>> {
    const token = await getFreshAccessToken()

    if (!token) {
        throw new Error("Nie jesteś zalogowany")
    }

    const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        }
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się oznaczyć jako przeczytane"
        try {
            const body = await response.json()
            errorMessage = body?.error?.message ?? body.error ?? body.message ?? errorMessage
        } catch {
            // ignore parse errors
        }
        throw new Error(errorMessage)
    }

    return {
        data: null
    }
}

// Mark notification as unread
export async function markNotificationAsUnread(notificationId: string): Promise<ApiResponse<null>> {
    const token = await getFreshAccessToken()

    if (!token) {
        throw new Error("Nie jesteś zalogowany")
    }

    const response = await fetch(`/api/notifications/${notificationId}/unread`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        }
    })

    if (!response.ok) {
        let errorMessage = "Nie udało się oznaczyć jako nieprzeczytane"
        try {
            const body = await response.json()
            errorMessage = body?.error?.message ?? body.error ?? body.message ?? errorMessage
        } catch {
            // ignore parse errors
        }
        throw new Error(errorMessage)
    }

    return {
        data: null
    }
}
