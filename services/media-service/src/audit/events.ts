/** Shape of an emitted audit event sent to external audit-log service. */
export type AuditEvent = {
    service: string;
    action: string;
    status: 'success' | 'failure' | 'warning' | 'error';
    log_type: 'ACTION' | 'SYSTEM' | 'SECURITY' | 'ERROR' | 'INFO';
    operation_id?: string;
    actor?: { id?: string; type?: string };
    target?: { id?: string; type?: string };
    metadata?: Record<string, unknown>;
};

/** Factory helpers to construct standardized audit events. */
export const auditEvents = {
    mediaUploaded: (actorId: string | undefined, mediaId: string, temporary: boolean): AuditEvent => ({
        service: 'media-service',
        action: 'media_uploaded',
        status: 'success',
        log_type: 'ACTION',
        actor: { id: actorId, type: 'user' },
        target: { id: mediaId, type: 'media' },
        metadata: { temporary },
    }),
    moderationChanged: (actorId: string | undefined, mediaId: string, from: string, to: string): AuditEvent => ({
        service: 'media-service',
        action: 'moderation_changed',
        status: 'success',
        log_type: 'ACTION',
        actor: { id: actorId, type: 'user' },
        target: { id: mediaId, type: 'media' },
        metadata: { from, to },
    }),
    mediaCensored: (actorId: string | undefined, mediaId: string, operation: string, strength: number): AuditEvent => ({
        service: 'media-service',
        action: 'media_censored',
        status: 'success',
        log_type: 'ACTION',
        actor: { id: actorId, type: 'user' },
        target: { id: mediaId, type: 'media' },
        metadata: { operation, strength },
    }),
    mediaDeleted: (actorId: string | undefined, mediaId: string): AuditEvent => ({
        service: 'media-service',
        action: 'media_deleted',
        status: 'success',
        log_type: 'ACTION',
        actor: { id: actorId, type: 'user' },
        target: { id: mediaId, type: 'media' },
    }),
    visibilityChanged: (actorId: string | undefined, mediaId: string, from: string, to: string): AuditEvent => ({
        service: 'media-service',
        action: 'visibility_changed',
        status: 'success',
        log_type: 'ACTION',
        actor: { id: actorId, type: 'user' },
        target: { id: mediaId, type: 'media' },
        metadata: { from, to },
    }),
    temporaryKept: (actorId: string | undefined, kept: string[]): AuditEvent => ({
        service: 'media-service',
        action: 'temporary_kept',
        status: 'success',
        log_type: 'ACTION',
        actor: { id: actorId, type: 'user' },
        metadata: { kept_count: kept.length, kept },
    }),
    temporaryRejected: (actorId: string | undefined, rejected: string[]): AuditEvent => ({
        service: 'media-service',
        action: 'temporary_rejected',
        status: 'success',
        log_type: 'ACTION',
        actor: { id: actorId, type: 'user' },
        metadata: { rejected_count: rejected.length, rejected },
    }),
    accessDenied: (actorId: string | undefined, path: string, permission: string, reason: string): AuditEvent => ({
        service: 'media-service',
        action: 'access_denied',
        status: 'warning',
        log_type: 'SECURITY',
        actor: { id: actorId, type: 'user' },
        metadata: { path, permission, reason },
    }),
    httpError: (path: string, status: number, code?: string): AuditEvent => ({
        service: 'media-service',
        action: 'http_error',
        status: 'error',
        log_type: 'ERROR',
        metadata: { path, status, code },
    }),
    storageThreshold: (level: 'warn' | 'critical', usedPercent: number, usedBytes: number): AuditEvent => ({
        service: 'media-service',
        action: `storage_threshold_${level}`,
        status: level === 'warn' ? 'warning' : 'error',
        log_type: 'SYSTEM',
        metadata: { usedPercent, usedBytes },
    }),
};
