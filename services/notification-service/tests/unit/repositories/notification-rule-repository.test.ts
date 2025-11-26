import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const queryMock = jest.fn() as jest.MockedFunction<(
    query: string,
    params?: unknown[]
) => Promise<{ rows: unknown[]; rowCount?: number }>>;

jest.mock("../../../src/database/database", () => ({
    database: {
        query: queryMock,
    }
}));

import { notificationRuleRepository } from "../../../src/repositories/notification-rule-repository";

describe("notificationRuleRepository", () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it("returns null when no rule found", async () => {
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const result = await notificationRuleRepository.findByEvent("USER_REGISTERED");

        expect(result).toBeNull();
    });

    it("returns null when rule inactive", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                id: "rule-1",
                event_type: "USER_REGISTERED",
                audience: "user",
                channels: JSON.stringify(["in_app"]),
                template_mappings: JSON.stringify({ in_app: "tpl" }),
                is_active: false,
            }],
            rowCount: 1,
        });

        const result = await notificationRuleRepository.findByEvent("USER_REGISTERED");

        expect(result).toBeNull();
    });

    it("parses active rules", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                id: "rule-1",
                event_type: "USER_REGISTERED",
                audience: "user",
                channels: JSON.stringify(["in_app", "email"]),
                template_mappings: JSON.stringify({ in_app: "tpl_in", email: "tpl_email" }),
                is_active: true,
            }],
            rowCount: 1,
        });

        const result = await notificationRuleRepository.findByEvent("USER_REGISTERED");

        expect(result).toEqual({
            id: "rule-1",
            eventType: "USER_REGISTERED",
            audience: "user",
            channels: ["in_app", "email"],
            templateMappings: { in_app: "tpl_in", email: "tpl_email" },
            isActive: true,
        });
        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("FROM notification_rules"), ["USER_REGISTERED"]);
    });
});
