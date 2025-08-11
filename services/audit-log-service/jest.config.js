module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*.test.ts"],
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.d.ts",
        "!src/server.ts", // Entry point excluded
        "!src/database/migrate.ts" // Migration script excluded
    ],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "html"],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.ts"],
    testTimeout: 10000,
    verbose: true,
    // Handle ES modules and path mapping
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
    }
}
