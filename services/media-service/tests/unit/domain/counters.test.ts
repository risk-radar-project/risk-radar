import { counters } from '../../../src/domain/counters';

describe('counters', () => {
    test('increments upload and read counters', () => {
        counters.uploads += 1;
        counters.reads.master += 2;
        expect(counters.uploads).toBeGreaterThan(0);
        expect(counters.reads.master).toBe(2);
    });
});
