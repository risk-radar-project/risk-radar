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

import { templateRepository } from "../../../src/repositories/template-repository";

describe("templateRepository", () => {
    beforeEach(() => {
        queryMock.mockReset();
    });

    it("returns null when template missing", async () => {
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const template = await templateRepository.findByKey("missing");

        expect(template).toBeNull();
    });

    it("maps template rows", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                id: "tpl-1",
                template_key: "WELCOME",
                event_type: "USER_REGISTERED",
                channel: "email",
                title: null,
                subject: "Hello",
                body: "<p>Hello</p>",
            }],
            rowCount: 1,
        });

        const template = await templateRepository.findByKey("WELCOME");

        expect(template).toEqual({
            id: "tpl-1",
            templateKey: "WELCOME",
            eventType: "USER_REGISTERED",
            channel: "email",
            title: null,
            subject: "Hello",
            body: "<p>Hello</p>",
        });
    });
});
