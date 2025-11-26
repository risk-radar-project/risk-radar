import { describe, expect, it } from "@jest/globals";
import { templateRenderer } from "../../src/services/template-renderer";

describe("TemplateRenderer", () => {
    it("replaces placeholders with provided variables", () => {
        const output = templateRenderer.render("Hi {{ name }}!", { name: "Risk Radar" });
        expect(output).toBe("Hi Risk Radar!");
    });

    it("omits placeholders that are not provided", () => {
        const output = templateRenderer.render("User: {{ name }}, email: {{ email }}", { name: "Test" });
        expect(output).toBe("User: Test, email: ");
    });

    it("returns empty string when template is empty", () => {
        expect(templateRenderer.render("", { foo: "bar" })).toBe("");
    });

    it("escapes html entities by default", () => {
        const output = templateRenderer.render("<div>{{ value }}</div>", {
            value: "<script>alert(1)</script>"
        });
        expect(output).toBe("<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>");
    });

    it("escapes values when rendering text", () => {
        const subject = templateRenderer.renderText("Subject: {{ value }}", {
            value: "<Admin>"
        });
        expect(subject).toBe("Subject: &lt;Admin&gt;");
    });

    it("sanitizes attributes to prevent breaking out of quotes", () => {
        const attr = templateRenderer.renderAttribute("data-user=\"{{ value }}\"", {
            value: "\" onload=\"alert(1)\""
        });
        expect(attr).toBe("data-user=\"&quot; onload=&quot;alert(1)&quot;\"");
    });
});
