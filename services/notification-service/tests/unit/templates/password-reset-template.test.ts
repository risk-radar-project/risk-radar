import { describe, expect, it } from "@jest/globals";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { templateDefinitions } from "../../../src/templates/template-definitions";

const TEMPLATE_KEY = "USER_PASSWORD_RESET_REQUESTED_EMAIL";

describe("password reset template", () => {
    const template = templateDefinitions.find((definition) => definition.templateKey === TEMPLATE_KEY);

    it("registers the password reset template with subject and body file", () => {
        expect(template).toBeDefined();
        expect(template?.subject).toBe("Resetuj hasło w RiskRadar");
        expect(template?.bodyFile).toBe("user-password-reset-requested.html");
    });

    it("ships an html template that references the reset URL", () => {
        const htmlPath = path.resolve(process.cwd(), "src/templates/email/user-password-reset-requested.html");
        expect(existsSync(htmlPath)).toBe(true);
        const markup = readFileSync(htmlPath, "utf-8");
        expect(markup).toContain("{{resetUrl}}");
        expect(markup).toContain("Ustal nowe hasło");
    });
});
