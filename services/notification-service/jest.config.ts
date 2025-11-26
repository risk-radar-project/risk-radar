import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    clearMocks: true,
    collectCoverage: true,
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.d.ts",
        "!src/**/index.ts",
        "!src/**/*.types.ts"
    ],
    coverageDirectory: "coverage",
    setupFilesAfterEnv: ["<rootDir>/tests/setup-env.ts"],
    testMatch: ["**/?(*.)+(spec|test).ts"],
    moduleFileExtensions: ["ts", "js", "json"],
    coverageThreshold: {
        global: {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80,
        }
    },
};

export default config;
