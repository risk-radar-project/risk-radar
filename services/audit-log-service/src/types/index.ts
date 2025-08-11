export interface AuditLogEntry {
    id?: string;
    timestamp: string;
    service: string;
    action: string;
    actor: {
        id: string;
        type: 'user' | 'admin' | 'system' | 'service' | 'unknown';
        ip?: string;
    };
    target?: {
        id?: string;
        type?: string;
    };
    status: 'success' | 'failure' | 'warning' | 'error';
    operation_id?: string | null;
    log_type: 'ACTION' | 'SECURITY' | 'SYSTEM' | 'ERROR' | 'INFO';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
    is_anonymized: boolean;
}

export interface PaginationQuery {
    page?: number;
    limit?: number;
}

export interface AuditLogFilters {
    service?: string;
    action?: string;
    actor_id?: string;
    target_id?: string;
    status?: 'success' | 'failure' | 'warning' | 'error';
    log_type?: 'ACTION' | 'SECURITY' | 'SYSTEM' | 'ERROR' | 'INFO';
    start_date?: string;
    end_date?: string;
}

export interface AnonymizeRequest {
    actor_id: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
