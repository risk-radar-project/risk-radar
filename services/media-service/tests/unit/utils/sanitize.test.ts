import { sanitizeString, parseBooleanFlag, validateEnum } from '../../../src/utils/sanitize';

describe('sanitizeString', () => {
    test('returns null for non-string', () => {
        expect(sanitizeString(123 as any, 10)).toBeNull();
        expect(sanitizeString(undefined, 10)).toBeNull();
        expect(sanitizeString(null as any, 10)).toBeNull();
    });

    test('trims and enforces max length', () => {
        const input = '   hello world   ';
        expect(sanitizeString(input, 5)).toBe('hello');
        expect(sanitizeString(input, 20)).toBe('hello world');
    });

    test('removes control chars and null bytes', () => {
        const input = 'a\u0000b\u0001c\u007F';
        expect(sanitizeString(input, 100)).toBe('abc');
    });

    test('returns null for empty or whitespace-only', () => {
        expect(sanitizeString('   ', 10)).toBeNull();
        expect(sanitizeString('', 10)).toBeNull();
    });
});

describe('parseBooleanFlag', () => {
    test('returns boolean for boolean input', () => {
        expect(parseBooleanFlag(true)).toBe(true);
        expect(parseBooleanFlag(false)).toBe(false);
    });

    test('parses common true strings', () => {
        ['1', 'true', 'True', 'yes', 'on'].forEach(v => expect(parseBooleanFlag(v)).toBe(true));
    });

    test('returns undefined for unrecognized values', () => {
        expect(parseBooleanFlag('foo')).toBeUndefined();
        expect(parseBooleanFlag(0)).toBeUndefined();
    });
});

describe('validateEnum', () => {
    test('returns value when allowed', () => {
        const allowed = ['a', 'b'] as const;
        expect(validateEnum('a', allowed as unknown as string[])).toBe('a');
    });

    test('returns undefined when not allowed', () => {
        const allowed = ['x', 'y'] as const;
        expect(validateEnum('z', allowed as unknown as string[])).toBeUndefined();
    });
});
