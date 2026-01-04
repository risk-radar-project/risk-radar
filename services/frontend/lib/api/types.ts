// Global API Types (placeholders for now)

export type ApiResponse<T> = {
    data: T
    error?: string
}

export type User = {
    id: string
    email: string
    username: string
    roles: string[]
    permissions?: string[]
}

export type Report = {
    id: string
    title: string
    description: string
    status: string
    createdAt: string
}

export type MediaAsset = {
    id: string
    url: string
    contentType: string
}

export type LoginEvent = {
    id?: string
    timestamp?: string
    service: string
    action: string
    actor: {
        id: string
        type: string
        ip?: string
    }
    status: string
    log_type: string
    metadata?: Record<string, unknown>
}
