export function sanitizeString(input: unknown, maxLen: number): string | null {
    if (typeof input !== "string") return null
    let v = input.trim()
    if (!v) return null
    if (v.length > maxLen) v = v.slice(0, maxLen)
    // basic XSS mitigation: remove control chars & null bytes
    v = v.replace(/[\u0000-\u001F\u007F]/g, "")
    return v
}

export function parseBooleanFlag(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
        if (/^(1|true|yes|on)$/i.test(value)) return true
        if (/^(0|false|no|off)$/i.test(value)) return false
        return undefined
    }
    return undefined
}

export function validateEnum<T extends string>(value: unknown, allowed: T[]): T | undefined {
    if (typeof value === "string" && (allowed as string[]).includes(value)) return value as T
    return undefined
}
