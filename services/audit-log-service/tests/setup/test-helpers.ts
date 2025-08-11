/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AuditLogEntry } from '../../src/types';

// Test data factories
export const createValidAuditLog = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => {
    return {
        id: 'test-audit-log-id',
        timestamp: new Date().toISOString(),
        service: 'test-service',
        action: 'test-action',
        actor: {
            id: 'test-user-id',
            type: 'user',
            ip: '192.168.1.1',
        },
        target: {
            type: 'resource',
            id: 'test-resource-id',
        },
        status: 'success',
        operation_id: 'test-operation-id',
        log_type: 'ACTION',
        metadata: {
            user_agent: 'Test Agent',
            request_id: 'req-123',
        },
        is_anonymized: false,
        ...overrides,
    };
};

export const createAnonymizedAuditLog = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => {
    return createValidAuditLog({
        actor: {
            id: '[ANONYMIZED]',
            type: 'user',
        },
        metadata: {
            user_agent: '[ANONYMIZED]',
            request_id: '[ANONYMIZED]',
        },
        is_anonymized: true,
        ...overrides,
    });
};

// Database mock helpers
export const createQueryResult = (rows: any[], rowCount?: number) => {
    return {
        rows,
        rowCount: rowCount ?? rows.length,
        command: 'SELECT',
        oid: 0,
        fields: [],
    };
};

export const createMockDatabase = () => {
    return {
        query: jest.fn(),
        connect: jest.fn(),
        end: jest.fn(),
    };
};

// WebSocket mock helpers
export const createMockSocket = () => {
    return {
        id: 'test-socket-id',
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
        on: jest.fn(),
        disconnect: jest.fn(),
    };
};

export const createMockSocketIO = () => {
    return {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        on: jest.fn(),
        sockets: {
            sockets: new Map(),
        },
    };
};

// Express mock helpers
export const createMockRequest = (overrides: any = {}) => {
    return {
        body: {},
        params: {},
        query: {},
        headers: {},
        ...overrides,
    };
};

export const createMockResponse = () => {
    const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis(),
    };
    return res;
};

export const createMockNext = () => {
    return jest.fn();
};

// Validation helpers
export const createValidCreateLogRequest = (overrides: any = {}) => {
    return {
        service: 'test-service',
        action: 'test-action',
        actor: {
            id: 'user123',
            type: 'user',
            ip: '192.168.1.1',
        },
        target: {
            type: 'resource',
            id: 'resource123',
        },
        status: 'success',
        log_type: 'ACTION',
        metadata: {
            user_agent: 'Test Browser',
        },
        ...overrides,
    };
};

export const createInvalidCreateLogRequest = (invalidField: string) => {
    const valid = createValidCreateLogRequest();

    switch (invalidField) {
    case 'service':
        return { ...valid, service: '' };
    case 'action':
        return { ...valid, action: null };
    case 'actor':
        return { ...valid, actor: { id: '' } };
    case 'status':
        return { ...valid, status: 'invalid-status' };
    case 'log_type':
        return { ...valid, log_type: 'invalid-type' };
    default:
        return valid;
    }
};

// Time helpers
export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const subtractDays = (date: Date, days: number): Date => {
    return addDays(date, -days);
};