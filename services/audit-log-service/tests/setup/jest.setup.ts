// Mock process.env for consistent testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Minimal logging during tests
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test_audit';
process.env.WEBSOCKET_ENABLED = 'false'; // Disable WebSocket by default in tests

// Global cleanup to help Jest exit gracefully
afterAll(async () => {
    // Clear all timers
    jest.clearAllTimers();
    // Reset all mocks
    jest.resetAllMocks();
    // Small delay to allow cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
});

export { };
