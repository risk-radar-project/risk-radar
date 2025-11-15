export type ServiceConfig = {
    nodeEnv: string
    logLevel: "debug" | "info" | "warn" | "error"
    httpPort: number
    trustProxy: boolean
    bodyLimit: string
    mediaRoot: string
    sizes: { thumbMax: number; previewMax: number; jpegQuality: number }
    limits: { maxBytes: number; maxPixels: number; altMaxLen: number; tagsMax: number; tagMaxLen: number }
    moderation: {
        enabled: boolean
        provider: "openai"
        timeoutMs: number
        model: string
        apiKey?: string
        failOpen: boolean
        resize: { maxPixels: number; maxWidth: number; maxHeight: number; jpegQuality: number }
    }
    db: { bootstrapRetries: number; bootstrapDelayMs: number; bootstrapMaxWaitMs: number }
    antivirus: { enabled: boolean }
    authz: {
        baseUrl: string
        timeoutMs: number
        retries: number
        breaker: { failureThreshold: number; halfOpenAfterMs: number }
    }
    audit: {
        baseUrl: string
        timeoutMs: number
        retries: number
        breaker: { failureThreshold: number; halfOpenAfterMs: number }
        kafka: {
            enabled: boolean
            brokers: string[]
            topic: string
            clientId: string
            acks: -1 | 0 | 1
            connectionTimeoutMs: number
            requestTimeoutMs: number
            sendTimeoutMs: number
            retries: number
            idempotent: boolean
        }
    }
    storageThresholds: { warnPercent: number; criticalPercent: number }
    gc: { enabled: boolean; intervalMs: number; deleteAfterDays: number; batchLimit: number }
    tempMediaTtlHours: number // lifetime for temporary media before auto purge
    cache: { immutableMaxAgeSeconds: number }
    censor: { defaultStrength: number; minStrength: number; maxStrength: number }
}

const toInt = (v: string | undefined, d: number) => (v ? parseInt(v, 10) : d)
const toBool = (v: string | undefined, d: boolean) => (v === undefined ? d : /^(1|true|yes)$/i.test(v))
const toList = (v: string | undefined) =>
    v ?
        v
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        : []
const toAcks = (v: string | undefined): -1 | 0 | 1 => {
    if (v === "0") return 0
    if (v === "1") return 1
    return -1
}

// Build service base URL from hostname + service port (always used now)
const serviceBaseUrl = (servicePortEnv: string | undefined, defaultPort: number) => {
    const host = process.env.HOSTNAME || "localhost"
    const port = servicePortEnv || String(defaultPort)
    return `http://${host}:${port}`
}

const normalizeBaseUrl = (v: string | undefined, fallback?: string) => {
    const raw = v || fallback || ""
    if (!raw) return raw
    // strip trailing slash
    let out = raw.replace(/\/+$/g, "")
    // if someone provided a full path ending with /logs, remove that to keep base URL
    out = out.replace(/\/logs$/i, "")
    return out
}

const auditKafkaBrokers = toList(process.env.AUDIT_KAFKA_BROKERS || process.env.KAFKA_BROKERS)
const auditKafkaEnabled = toBool(process.env.AUDIT_KAFKA_ENABLED, auditKafkaBrokers.length > 0)
const auditKafkaTopic = process.env.AUDIT_KAFKA_TOPIC || process.env.KAFKA_TOPIC || "audit_logs"
const auditKafkaClientId = process.env.AUDIT_KAFKA_CLIENT_ID || "media-service"
const auditKafkaAcks = toAcks(process.env.AUDIT_KAFKA_ACKS)
const auditKafkaConnectionTimeoutMs = toInt(process.env.AUDIT_KAFKA_CONNECTION_TIMEOUT_MS, 3000)
const auditKafkaRequestTimeoutMs = toInt(process.env.AUDIT_KAFKA_REQUEST_TIMEOUT_MS, 5000)
const auditKafkaSendTimeoutMs = toInt(process.env.AUDIT_KAFKA_SEND_TIMEOUT_MS, 5000)
const auditKafkaRetries = toInt(process.env.AUDIT_KAFKA_RETRIES, 3)
const auditKafkaIdempotent = toBool(process.env.AUDIT_KAFKA_IDEMPOTENT, true)

export const config: ServiceConfig = {
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: (process.env.LOG_LEVEL as any) || "debug",
    httpPort: toInt(process.env.HTTP_PORT, 8080),
    trustProxy: toBool(process.env.TRUST_PROXY, true),
    bodyLimit: process.env.BODY_LIMIT || "20mb",
    mediaRoot: process.env.MEDIA_ROOT || "./data",
    sizes: {
        thumbMax: toInt(process.env.THUMB_MAX, 320),
        previewMax: toInt(process.env.PREVIEW_MAX, 1280),
        jpegQuality: toInt(process.env.JPEG_QUALITY, 82)
    },
    limits: {
        maxBytes: toInt(process.env.MAX_FILE_BYTES, 15 * 1024 * 1024),
        maxPixels: toInt(process.env.MAX_PIXELS, 12_000_000),
        altMaxLen: toInt(process.env.ALT_MAX_LEN, 512),
        tagsMax: toInt(process.env.TAGS_MAX, 32),
        tagMaxLen: toInt(process.env.TAG_MAX_LEN, 64)
    },
    moderation: {
        enabled: toBool(process.env.MODERATION_ENABLED, false),
        provider: "openai",
        timeoutMs: toInt(process.env.MODERATION_TIMEOUT_MS, 3000),
        model: process.env.MODERATION_MODEL || "omni-moderation-latest",
        apiKey: process.env.OPENAI_API_KEY,
        failOpen: toBool(process.env.MODERATION_FAIL_OPEN, false),
        resize: {
            maxPixels: toInt(process.env.MODERATION_RESIZE_MAX_PIXELS, 1_000_000),
            maxWidth: toInt(process.env.MODERATION_RESIZE_MAX_WIDTH, 1280),
            maxHeight: toInt(process.env.MODERATION_RESIZE_MAX_HEIGHT, 1280),
            jpegQuality: toInt(process.env.MODERATION_RESIZE_JPEG_QUALITY, 80)
        }
    },
    antivirus: { enabled: toBool(process.env.AV_ENABLED, false) },
    db: {
        bootstrapRetries: toInt(process.env.DB_BOOTSTRAP_RETRIES, 30),
        bootstrapDelayMs: toInt(process.env.DB_BOOTSTRAP_DELAY_MS, 2000),
        bootstrapMaxWaitMs: toInt(process.env.DB_BOOTSTRAP_MAX_WAIT_MS, 300000)
    },
    authz: {
        baseUrl: normalizeBaseUrl(process.env.AUTHZ_BASE_URL, serviceBaseUrl(process.env.AUTHZ_SERVICE_PORT, 8081)),
        timeoutMs: toInt(process.env.AUTHZ_TIMEOUT_MS, 1500),
        retries: toInt(process.env.AUTHZ_RETRIES, 2),
        breaker: {
            failureThreshold: toInt(process.env.AUTHZ_BREAKER_FAILURES, 5),
            halfOpenAfterMs: toInt(process.env.AUTHZ_BREAKER_HALF_OPEN_MS, 10_000)
        }
    },
    audit: {
        baseUrl: normalizeBaseUrl(process.env.AUDIT_BASE_URL, serviceBaseUrl(process.env.AUDIT_LOG_SERVICE_PORT, 8082)),
        timeoutMs: toInt(process.env.AUDIT_TIMEOUT_MS, 1500),
        retries: toInt(process.env.AUDIT_RETRIES, 2),
        breaker: {
            failureThreshold: toInt(process.env.AUDIT_BREAKER_FAILURES, 5),
            halfOpenAfterMs: toInt(process.env.AUDIT_BREAKER_HALF_OPEN_MS, 10_000)
        },
        kafka: {
            enabled: auditKafkaEnabled,
            brokers: auditKafkaBrokers,
            topic: auditKafkaTopic,
            clientId: auditKafkaClientId,
            acks: auditKafkaAcks,
            connectionTimeoutMs: auditKafkaConnectionTimeoutMs,
            requestTimeoutMs: auditKafkaRequestTimeoutMs,
            sendTimeoutMs: auditKafkaSendTimeoutMs,
            retries: auditKafkaRetries,
            idempotent: auditKafkaIdempotent
        }
    },
    storageThresholds: {
        warnPercent: toInt(process.env.STORAGE_WARN_PERCENT, 80),
        criticalPercent: toInt(process.env.STORAGE_CRITICAL_PERCENT, 90)
    },
    gc: {
        enabled: toBool(process.env.GC_ENABLED, true),
        intervalMs: toInt(process.env.GC_INTERVAL_MS, 6_000),
        deleteAfterDays: toInt(process.env.GC_DELETE_AFTER_DAYS, 30),
        batchLimit: toInt(process.env.GC_BATCH_LIMIT, 100)
    },
    tempMediaTtlHours: toInt(process.env.TEMP_MEDIA_TTL_HOURS, 24),
    cache: {
        immutableMaxAgeSeconds: toInt(process.env.CACHE_IMMUTABLE_MAX_AGE, 31_536_000) // 365 days
    },
    censor: {
        defaultStrength: toInt(process.env.CENSOR_DEFAULT_STRENGTH, 16),
        minStrength: toInt(process.env.CENSOR_MIN_STRENGTH, 2),
        maxStrength: toInt(process.env.CENSOR_MAX_STRENGTH, 128)
    }
}
