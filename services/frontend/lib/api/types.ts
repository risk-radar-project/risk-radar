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
    category?: string
    latitude?: number
    longitude?: number
    imageIds?: string[]
    aiIsFake?: boolean
    aiFakeProbability?: number
    aiConfidence?: string
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

export interface AuditLog {
    id: string
    timestamp: string
    service: string
    action: string
    actor: {
        id: string
        type: string
        ip?: string
    }
    target?: {
        id: string
        type: string
    }
    status: "success" | "failure" | "warning" | "error"
    log_type: "ACTION" | "SECURITY" | "SYSTEM" | "ERROR" | "INFO"
    metadata?: Record<string, unknown>
    operation_id?: string
    is_anonymized: boolean
}

export interface AuditLogFilters {
    service?: string
    action?: string
    actor_id?: string
    target_id?: string
    status?: string
    log_type?: string
    start_date?: string
    end_date?: string
    page?: number
    limit?: number
    sort_by?: string
    order?: "asc" | "desc"
}

export interface AuditLogResponse {
    data: AuditLog[]
    pagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}
