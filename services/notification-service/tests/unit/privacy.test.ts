import { describe, expect, it } from "@jest/globals";
import { hashEmail, maskEmail } from "../../src/utils/privacy";

describe("privacy utils", () => {
    it("hashEmail normalizes casing and whitespace", () => {
        const first = hashEmail("User@example.com");
        const second = hashEmail("  user@example.com  ");
        expect(first).toBe(second);
        expect(first).toMatch(/^[a-f0-9]{64}$/);
    });

    it("maskEmail preserves first/last character and domain", () => {
        const masked = maskEmail("person@example.com");
        expect(masked).toBe("p****n@example.com");
    });

    it("maskEmail handles short local parts", () => {
        const masked = maskEmail("ab@example.com");
        expect(masked).toBe("a*@example.com");
    });
});
