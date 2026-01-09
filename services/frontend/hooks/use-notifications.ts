"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    getNotifications,
    markNotificationAsRead,
    markNotificationAsUnread,
    type GetNotificationsParams
} from "@/lib/api/notifications"

// Fetch notifications with pagination and filters
export function useNotifications(params: GetNotificationsParams = {}) {
    return useQuery({
        queryKey: ["notifications", params],
        queryFn: async () => (await getNotifications(params)).data
    })
}

// Get count of unread notifications
export function useUnreadNotificationsCount() {
    // Check if user is authenticated by checking for access token
    const isAuthenticated = typeof window !== "undefined" && Boolean(localStorage.getItem("access_token"))

    return useQuery({
        queryKey: ["notifications-unread-count"],
        enabled: isAuthenticated,
        queryFn: async () => {
            const response = await getNotifications({ isRead: false, limit: 100 })
            return response.data.data?.length || 0
        }
    })
}

// Mark notification as read mutation
export function useMarkNotificationAsRead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (notificationId: string) => {
            return await markNotificationAsRead(notificationId)
        },
        onSuccess: () => {
            // Invalidate all notification queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ["notifications"] })
            queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] })
        }
    })
}

// Mark notification as unread mutation
export function useMarkNotificationAsUnread() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (notificationId: string) => {
            return await markNotificationAsUnread(notificationId)
        },
        onSuccess: () => {
            // Invalidate all notification queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ["notifications"] })
            queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] })
        }
    })
}
