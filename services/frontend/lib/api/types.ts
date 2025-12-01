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
