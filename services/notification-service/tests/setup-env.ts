import { jest } from "@jest/globals";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.PORT = process.env.PORT || "0";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test:test@localhost:5432/risk-radar-test";
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || "";
process.env.SMTP_HOST = process.env.SMTP_HOST || "localhost";
process.env.SMTP_PORT = process.env.SMTP_PORT || "1025";
process.env.MAIL_FROM = process.env.MAIL_FROM || "Powiadomienia <no-reply@test.local>";
process.env.USER_SERVICE_BASE_URL = process.env.USER_SERVICE_BASE_URL || "http://localhost:0";
process.env.AUDIT_LOG_SERVICE_BASE_URL = process.env.AUDIT_LOG_SERVICE_BASE_URL || "http://localhost:0";

jest.setTimeout(10000);
