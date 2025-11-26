import crypto from "crypto";

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function hashEmail(email: string): string {
    return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function maskEmail(email: string): string {
    const normalized = normalizeEmail(email);
    const [localPart, domain] = normalized.split("@");
    if (!localPart || !domain) {
        return "***";
    }
    if (localPart.length <= 2) {
        return localPart[0] + "*@" + domain;
    }
    const maskedLocal = `${localPart[0]}${"*".repeat(localPart.length - 2)}${localPart[localPart.length - 1]}`;
    return `${maskedLocal}@${domain}`;
}
