import { v4 as uuidv4 } from "uuid";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { database } from "../database";
import { templateDefinitions, TemplateDefinition } from "../../templates/template-definitions";
import { ruleDefinitions } from "../../templates/rule-definitions";
import { logger } from "../../utils/logger";

interface LoadedTemplate {
    body: string;
    filePath?: string;
}

const templateSearchPaths = Array.from(new Set([
    path.resolve(__dirname, "../../templates/email"),
    path.resolve(__dirname, "../../../src/templates/email"),
    path.resolve(process.cwd(), "src/templates/email"),
    path.resolve(process.cwd(), "dist/templates/email"),
]));

function resolveTemplateBody(definition: TemplateDefinition): LoadedTemplate {
    if (definition.body) {
        return { body: definition.body };
    }
    if (!definition.bodyFile) {
        throw new Error(`Template ${definition.templateKey} missing body definition`);
    }

    for (const basePath of templateSearchPaths) {
        const candidate = path.join(basePath, definition.bodyFile);
        if (existsSync(candidate)) {
            return {
                body: readFileSync(candidate, "utf-8"),
                filePath: candidate,
            };
        }
    }

    throw new Error(`Template file ${definition.bodyFile} not found for ${definition.templateKey}`);
}

function inlineStyles(content: string, filePath?: string): string {
    if (!filePath) {
        return content;
    }

    const resolvedFilePath = filePath as string;
    const templateDir = path.dirname(resolvedFilePath);
    const linkRegex = /<link[^>]*data-inline-styles=["']true["'][^>]*>/gi;
    return content.replace(linkRegex, (match) => {
        const hrefMatch = match.match(/href=["']([^"']+)["']/i);
        if (!hrefMatch) {
            logger.warn("Inline styles link missing href attribute");
            return "";
        }
        const hrefValue = hrefMatch[1];
        if (!hrefValue) {
            logger.warn("Inline styles link has empty href");
            return "";
        }
        const cssPath = path.resolve(templateDir, hrefValue);
        if (!existsSync(cssPath)) {
            logger.warn("Inline styles file not found", { cssPath });
            return "";
        }
        const cssContent = readFileSync(cssPath, "utf-8");
        return `<style>${cssContent}</style>`;
    });
}

async function seedTemplates(): Promise<void> {
    for (const definition of templateDefinitions) {
        const { body, filePath } = resolveTemplateBody(definition);
        const processedBody = inlineStyles(body, filePath);
        await database.query(
            `INSERT INTO notification_templates (id, template_key, event_type, channel, title, subject, body)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (template_key) DO UPDATE
             SET title = EXCLUDED.title,
                 subject = EXCLUDED.subject,
                 body = EXCLUDED.body,
                 updated_at = NOW()`,
            [
                uuidv4(),
                definition.templateKey,
                definition.eventType,
                definition.channel,
                definition.title ?? null,
                definition.subject ?? null,
                processedBody
            ]
        );
    }
    logger.debug(`Seeded ${templateDefinitions.length} templates`);
}

async function seedRules(): Promise<void> {
    for (const definition of ruleDefinitions) {
        await database.query(
            `INSERT INTO notification_rules (id, event_type, audience, channels, template_mappings, is_active)
             VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, true)
             ON CONFLICT (event_type) DO UPDATE
             SET audience = EXCLUDED.audience,
                 channels = EXCLUDED.channels,
                 template_mappings = EXCLUDED.template_mappings,
                 updated_at = NOW()`,
            [
                uuidv4(),
                definition.eventType,
                definition.audience,
                JSON.stringify(definition.channels),
                JSON.stringify(definition.templateMappings)
            ]
        );
    }
    logger.debug(`Seeded ${ruleDefinitions.length} rules`);
}

export async function runSeeder(): Promise<void> {
    await database.waitForConnection();
    await seedTemplates();
    await seedRules();
}

if (require.main === module) {
    runSeeder()
        .then(() => {
            logger.info("Seeding completed");
            process.exit(0);
        })
        .catch((error) => {
            logger.error("Seeding failed", { error });
            process.exit(1);
        });
}
