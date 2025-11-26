type RenderMode = "html" | "text" | "attribute";

const HTML_ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
};

export class TemplateRenderer {
    render(content: string, variables: Record<string, unknown>): string {
        return this.renderWithMode(content, variables, "html");
    }

    renderHtml(content: string, variables: Record<string, unknown>): string {
        return this.renderWithMode(content, variables, "html");
    }

    renderText(content: string, variables: Record<string, unknown>): string {
        return this.renderWithMode(content, variables, "text");
    }

    renderAttribute(content: string, variables: Record<string, unknown>): string {
        return this.renderWithMode(content, variables, "attribute");
    }

    private renderWithMode(
        content: string,
        variables: Record<string, unknown>,
        mode: RenderMode
    ): string {
        if (!content) {
            return "";
        }

        return content.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => {
            const value = variables[key];
            if (value === undefined || value === null) {
                return "";
            }
            return this.escapeValue(String(value), mode);
        });
    }

    private escapeValue(value: string, mode: RenderMode): string {
        if (!value) {
            return "";
        }

        switch (mode) {
        case "attribute":
            return TemplateRenderer.escapeAttribute(value);
        case "text":
            return TemplateRenderer.escapeText(value);
        case "html":
        default:
            return TemplateRenderer.escapeHtml(value);
        }
    }

    private static escapeHtml(value: string): string {
        return value.replace(/[&<>"'`]/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
    }

    private static escapeAttribute(value: string): string {
        return TemplateRenderer.escapeHtml(value)
            .replace(/\r/g, "&#13;")
            .replace(/\n/g, "&#10;")
            .replace(/\t/g, "&#9;");
    }

    private static escapeText(value: string): string {
        const sanitized = value.replace(/[&<>]/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
        // Strip ASCII control characters from user-provided text.
        // eslint-disable-next-line no-control-regex
        return sanitized.replace(/[\u0000-\u001F\u007F]/g, "");
    }
}

export const templateRenderer = new TemplateRenderer();
