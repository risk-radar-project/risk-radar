import { describe, expect, it } from "@jest/globals";
import { hashEmail, maskEmail } from "../../../src/utils/privacy";

describe("privacy utils", () => {
    it("hashes email case-insensitively", () => {
        const lower = hashEmail("User@example.com");
        const upper = hashEmail("  user@EXAMPLE.com  ");

        expect(lower).toBe(upper);
        expect(lower).toHaveLength(64);
    });

    it("masks email with preserved boundaries", () => {
        expect(maskEmail("john.doe@example.com")).toBe("j******e@example.com");
        expect(maskEmail("ab@example.com")).toBe("a*@example.com");
    });

    it("returns fallback for invalid addresses", () => {
        expect(maskEmail("not-an-email")).toBe("***");
    });
});
