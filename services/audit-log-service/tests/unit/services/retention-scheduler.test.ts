/* eslint-disable @typescript-eslint/no-explicit-any */
import { retentionScheduler } from '../../../src/services/retention-scheduler';

jest.useFakeTimers({ legacyFakeTimers: false });

// Mocks
jest.mock('../../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const cleanupMock = jest.fn();
jest.mock('../../../src/services/audit-log-service', () => ({
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    auditLogService: { cleanupOldLogs: (...args: any[]) => cleanupMock(...args) },
}));

describe('RetentionScheduler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cleanupMock.mockReset();
        // Ensure scheduler is stopped before each test
        retentionScheduler.stop();
    });

    afterAll(() => {
        retentionScheduler.stop();
        // Ensure no fake timers leak into global teardown
        jest.useRealTimers();
    });

    it('runs immediate cleanup on start and schedules daily cleanup (no deletions)', async () => {
        // Arrange: first run returns 0 (no deletions)
        cleanupMock.mockResolvedValueOnce(0);

        // Act
        retentionScheduler.start();

        // Assert immediate run
        expect(cleanupMock).toHaveBeenCalledTimes(1);

        // Simulate 24h interval (86_400_000 ms)
        cleanupMock.mockResolvedValueOnce(0);
        jest.advanceTimersByTime(24 * 60 * 60 * 1000);

        expect(cleanupMock).toHaveBeenCalledTimes(2);
    });

    it('logs positive deletions and continues on next interval', async () => {
        // Arrange: first run deletes some rows, second run none
        cleanupMock.mockResolvedValueOnce(5);

        retentionScheduler.start();
        expect(cleanupMock).toHaveBeenCalledTimes(1);

        cleanupMock.mockResolvedValueOnce(0);
        jest.advanceTimersByTime(24 * 60 * 60 * 1000);

        expect(cleanupMock).toHaveBeenCalledTimes(2);
    });

    it('does not start twice and handles errors during cleanup gracefully', async () => {
        // First start
        cleanupMock.mockResolvedValueOnce(0);
        retentionScheduler.start();
        expect(cleanupMock).toHaveBeenCalledTimes(1);

        // Second start should warn and not double schedule
        retentionScheduler.start();

        // Next tick throws error but should not crash
        cleanupMock.mockRejectedValueOnce(new Error('DB error'));
        jest.advanceTimersByTime(24 * 60 * 60 * 1000);

        expect(cleanupMock).toHaveBeenCalledTimes(2); // only one extra call
    });

    it('stops the scheduler and clears interval', () => {
        cleanupMock.mockResolvedValueOnce(0);
        retentionScheduler.start();
        retentionScheduler.stop();
        // Advance time - no further calls
        jest.advanceTimersByTime(24 * 60 * 60 * 1000);
        expect(cleanupMock).toHaveBeenCalledTimes(1);
    });
});
