"use client"

export function usePermissions() {
    return {
        isAdmin: false,
        canModerate: false,
        canViewStats: false
    }
}
