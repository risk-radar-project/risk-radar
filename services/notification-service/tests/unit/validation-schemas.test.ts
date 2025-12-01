import { describe, expect, it } from "@jest/globals";
import { fallbackSendSchema, notificationIdParamsSchema } from "../../src/validation/schemas";

describe("validation schemas", () => {
    it("accepts valid fallback payload", () => {
        const result = fallbackSendSchema.validate({
            eventType: "USER_REGISTERED",
            userId: "11111111-1111-4111-8111-111111111111",
            payload: { email: "john@example.com" }
        });
        expect(result.error).toBeUndefined();
    });

    it("rejects invalid uuid with friendly message", () => {
        const result = fallbackSendSchema.validate({
            eventType: "USER_REGISTERED",
            userId: "invalid-id"
        });
        expect(result.error?.details?.[0]?.message).toBe('"userId" must be a valid UUID');
    });

    it("requires resetUrl for password reset events", () => {
        const result = fallbackSendSchema.validate({
            eventType: "USER_PASSWORD_RESET_REQUESTED",
            userId: "11111111-1111-4111-8111-111111111111",
            payload: {}
        });
        expect(result.error?.details?.[0]?.message).toContain('"payload.resetUrl" is required');
    });

    it("accepts password reset events with a valid url", () => {
        const result = fallbackSendSchema.validate({
            eventType: "USER_PASSWORD_RESET_REQUESTED",
            userId: "11111111-1111-4111-8111-111111111111",
            payload: { resetUrl: "https://app.risk-radar/reset?token=abc" }
        });
        expect(result.error).toBeUndefined();
    });

    it("validates notification id params", () => {
        const good = notificationIdParamsSchema.validate({ id: "22222222-3333-4333-9333-111111111111" });
        expect(good.error).toBeUndefined();

        const bad = notificationIdParamsSchema.validate({ id: "abc" });
        expect(bad.error?.details?.[0]?.message).toBe('"id" must be a valid UUID');
    });
});
