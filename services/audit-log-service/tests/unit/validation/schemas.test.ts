import {
    createLogSchema,
    getLogsQuerySchema,
    getLogByIdSchema,
    anonymizeLogsSchema,
    anonymizeQuerySchema
} from '../../../src/validation/schemas';
import {
    createValidCreateLogRequest,
    createInvalidCreateLogRequest
} from '../../setup/test-helpers';

describe('Validation Schemas', () => {
    describe('createLogSchema', () => {
        it('should validate valid audit log creation request', () => {
            // Arrange
            const validRequest = createValidCreateLogRequest();

            // Act
            const { error, value } = createLogSchema.validate(validRequest);

            // Assert
            expect(error).toBeUndefined();
            expect(value).toEqual(expect.objectContaining(validRequest));
        });

        it('should reject request with missing required fields', () => {
            // Arrange
            const invalidRequest = { service: 'test' }; // Missing other required fields

            // Act
            const { error } = createLogSchema.validate(invalidRequest);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details.length).toBeGreaterThan(0);
        });

        it('should reject request with empty service', () => {
            // Arrange
            const invalidRequest = createInvalidCreateLogRequest('service');

            // Act
            const { error } = createLogSchema.validate(invalidRequest);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['service']);
        });

        it('should reject request with invalid status', () => {
            // Arrange
            const invalidRequest = createInvalidCreateLogRequest('status');

            // Act
            const { error } = createLogSchema.validate(invalidRequest);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['status']);
        });

        it('should reject request with invalid log_type', () => {
            // Arrange
            const invalidRequest = createInvalidCreateLogRequest('log_type');

            // Act
            const { error } = createLogSchema.validate(invalidRequest);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['log_type']);
        });

        it('should allow optional fields to be missing', () => {
            // Arrange
            const validMinimalRequest = {
                service: 'test-service',
                action: 'test-action',
                actor: {
                    id: 'user123',
                    type: 'user',
                },
                status: 'success',
                log_type: 'ACTION',
                // Optional fields omitted: target, operation_id, metadata
            };

            // Act
            const { error, value } = createLogSchema.validate(validMinimalRequest);

            // Assert
            expect(error).toBeUndefined();
            expect(value.service).toBe('test-service');
        });

        it('should validate complex nested metadata', () => {
            // Arrange
            const requestWithComplexMetadata = createValidCreateLogRequest({
                metadata: {
                    request_id: 'req-123',
                    session_id: 'sess-456',
                    api_version: 'v1',
                    client_info: {
                        browser: 'Chrome',
                        version: '91.0',
                    },
                    array_data: [1, 2, 3],
                },
            });

            // Act
            const { error, value } = createLogSchema.validate(requestWithComplexMetadata);

            // Assert
            expect(error).toBeUndefined();
            expect(value.metadata.client_info.browser).toBe('Chrome');
        });
    });

    describe('getLogsQuerySchema', () => {
        it('should validate valid query parameters', () => {
            // Arrange
            const validQuery = {
                service: 'user-service',
                action: 'login',
                status: 'success',
                page: 1,
                limit: 20,
                start_date: '2024-01-01T00:00:00Z',
                end_date: '2024-12-31T23:59:59Z',
            };

            // Act
            const { error, value } = getLogsQuerySchema.validate(validQuery);

            // Assert
            expect(error).toBeUndefined();
            expect(value.page).toBe(1);
            expect(value.limit).toBe(20);
        });

        it('should allow empty query parameters', () => {
            // Arrange
            const emptyQuery = {};

            // Act
            const { error, value } = getLogsQuerySchema.validate(emptyQuery);

            // Assert
            expect(error).toBeUndefined();
            expect(value.page).toBe(1); // Default value
            expect(value.limit).toBe(50); // Default value
        });

        it('should reject invalid status values', () => {
            // Arrange
            const invalidQuery = { status: 'invalid-status' };

            // Act
            const { error } = getLogsQuerySchema.validate(invalidQuery);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['status']);
        });

        it('should reject invalid log_type values', () => {
            // Arrange
            const invalidQuery = { log_type: 'invalid-type' };

            // Act
            const { error } = getLogsQuerySchema.validate(invalidQuery);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['log_type']);
        });

        it('should reject negative page numbers', () => {
            // Arrange
            const invalidQuery = { page: -1 };

            // Act
            const { error } = getLogsQuerySchema.validate(invalidQuery);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['page']);
        });

        it('should reject zero or negative limit', () => {
            // Arrange
            const invalidQuery = { limit: 0 };

            // Act
            const { error } = getLogsQuerySchema.validate(invalidQuery);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['limit']);
        });

        it('should reject invalid date formats', () => {
            // Arrange
            const invalidQuery = { start_date: 'not-a-date' };

            // Act
            const { error } = getLogsQuerySchema.validate(invalidQuery);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['start_date']);
        });
    });

    describe('getLogByIdSchema', () => {
        it('should validate valid UUIDs', () => {
            // Arrange
            const validUuids = [
                '123e4567-e89b-12d3-a456-426614174000',
                'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                '550e8400-e29b-41d4-a716-446655440000',
            ];

            // Act & Assert
            validUuids.forEach(uuid => {
                const { error } = getLogByIdSchema.validate({ id: uuid });
                expect(error).toBeUndefined();
            });
        });

        it('should reject invalid UUIDs', () => {
            // Arrange
            const invalidUuids = [
                'not-a-uuid',
                '123',
                '123e4567-e89b-12d3-a456', // Too short
                '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
                '123e4567_e89b_12d3_a456_426614174000', // Wrong separators
            ];

            // Act & Assert
            invalidUuids.forEach(uuid => {
                const { error } = getLogByIdSchema.validate({ id: uuid });
                expect(error).toBeDefined();
            });
        });
    });

    describe('anonymizeLogsSchema', () => {
        it('should validate valid anonymization request', () => {
            // Arrange
            const validRequest = {
                actor_id: 'user123',
            };

            // Act
            const { error, value } = anonymizeLogsSchema.validate(validRequest);

            // Assert
            expect(error).toBeUndefined();
            expect(value).toEqual(validRequest);
        });

        it('should reject request without actor_id', () => {
            // Arrange
            const invalidRequest = {};

            // Act
            const { error } = anonymizeLogsSchema.validate(invalidRequest);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['actor_id']);
        });

        it('should reject empty actor_id', () => {
            // Arrange
            const invalidRequest = { actor_id: '' };

            // Act
            const { error } = anonymizeLogsSchema.validate(invalidRequest);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['actor_id']);
        });
    });

    describe('anonymizeQuerySchema', () => {
        it('should validate valid dry_run parameter', () => {
            // Arrange
            const validQueries = [
                { dry_run: 'true' },
                { dry_run: 'false' },
                {}, // Optional parameter
            ];

            // Act & Assert
            validQueries.forEach(query => {
                const { error } = anonymizeQuerySchema.validate(query);
                expect(error).toBeUndefined();
            });
        });

        it('should reject invalid dry_run values', () => {
            // Arrange
            const invalidQuery = { dry_run: 'yes' };

            // Act
            const { error } = anonymizeQuerySchema.validate(invalidQuery);

            // Assert
            expect(error).toBeDefined();
            expect(error!.details![0]!.path).toEqual(['dry_run']);
        });
    });
});
