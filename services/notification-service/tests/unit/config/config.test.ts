import { describe, expect, it, afterEach, beforeEach, jest } from "@jest/globals";
import type { Config } from "../../../src/config/config";

const ORIGINAL_ENV = process.env;

const DEFAULT_ENV = {
    DATABASE_URL: "postgres://notification-service@localhost:5432/notification",
};

async function loadConfig(overrides: NodeJS.ProcessEnv = {}): Promise<Config> {
    jest.resetModules();
    process.env = { ...DEFAULT_ENV, ...overrides } as NodeJS.ProcessEnv;
    const module = await import("../../../src/config/config");
    return module.config;
}

beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
    jest.resetModules();
    process.env = ORIGINAL_ENV;
});

describe("config", () => {
    it("uses defaults when numeric env values are invalid", async () => {
        const config = await loadConfig({
            PORT: "not-a-number",
            SMTP_PORT: "",
            KAFKA_BROKERS: "",
            LOG_DB_QUERIES: "maybe",
            EMAIL_RETRY_DELAYS_MS: "",
        });

        expect(config.port).toBe(8086);
        expect(config.smtpPort).toBe(1025);
        expect(config.kafkaBrokers).toEqual([]);
        expect(config.logDbQueries).toBe(false);
        expect(config.emailRetryDelays).toEqual([15000, 30000, 120000, 600000, 1800000]);
    });

    it("parses complex env overrides", async () => {
        const config = await loadConfig({
            PORT: "9090",
            LOG_DB_QUERIES: "true",
            LOG_KAFKA_EVENTS: "true",
            KAFKA_BROKERS: "broker-a:9092, broker-b:9092",
            AUDIT_KAFKA_BROKERS: "",
            AUDIT_KAFKA_ACKS: "0",
            EMAIL_RETRY_DELAYS_MS: "1000, invalid, 2000",
            MAIL_FROM: "Alerts <alerts@example.com>",
            AUDIT_KAFKA_ENABLED: "false",
        });

        expect(config.port).toBe(9090);
        expect(config.logDbQueries).toBe(true);
        expect(config.logKafkaEvents).toBe(true);
        expect(config.kafkaBrokers).toEqual(["broker-a:9092", "broker-b:9092"]);
        expect(config.auditKafka.brokers).toEqual(["broker-a:9092", "broker-b:9092"]);
        expect(config.auditKafka.acks).toBe(0);
        expect(config.emailRetryDelays).toEqual([1000, 2000]);
        expect(config.mailFrom).toBe("Alerts <alerts@example.com>");
        expect(config.auditKafka.enabled).toBe(false);
    });

    it("throws when DATABASE_URL is missing", async () => {
        await expect(loadConfig({ DATABASE_URL: "" })).rejects.toThrow("DATABASE_URL environment variable is required");
    });

    it("accepts all audit Kafka ack variants", async () => {
        const allConfig = await loadConfig({ AUDIT_KAFKA_ACKS: "all" });
        expect(allConfig.auditKafka.acks).toBe(-1);

        const minusOneConfig = await loadConfig({ AUDIT_KAFKA_ACKS: "-1" });
        expect(minusOneConfig.auditKafka.acks).toBe(-1);

        const oneConfig = await loadConfig({ AUDIT_KAFKA_ACKS: "1" });
        expect(oneConfig.auditKafka.acks).toBe(1);

        const fallbackConfig = await loadConfig({ AUDIT_KAFKA_ACKS: "invalid" });
        expect(fallbackConfig.auditKafka.acks).toBe(-1);
    });
});
