import type { Config } from 'jest';

const tsTransform: [string, any] = ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true, diagnostics: true, compiler: 'typescript', astTransformers: {}, isolatedModules: false, compilerOptions: { module: 'ES2022' } }];

const common = {
    moduleNameMapper: {
        '^((?:\.\.?|src|tests)\/.*)\.js$': '$1'
    }
};

const config: Config = {
    testEnvironment: 'node',
    verbose: false,
    maxWorkers: 1,
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/index.ts',
        '!src/**/*.d.ts',
        '!src/server.ts',
        '!src/media-server.ts',
        '!src/bootstrap/**',
        '!src/db/migrate.ts',
        '!src/db/**',
        '!src/routes/**/*.ts',
        '!src/controllers/media-controller.ts'
    ],
    coverageDirectory: 'coverage',
    coverageThreshold: {
        global: {
            statements: 80,
            lines: 80,
            branches: 55,
            functions: 75,
        }
    },
    moduleFileExtensions: ['ts', 'js', 'json'],
    extensionsToTreatAsEsm: ['.ts'],
    transform: { '^.+\\.(ts|tsx)$': tsTransform, '^.+\\.(mjs|js)$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }] },
    transformIgnorePatterns: [
        '/node_modules/(?!file-type|strtok3|token-types)/'
    ],
    projects: [
        {
            displayName: 'unit',
            testMatch: ['**/tests/unit/**/*.test.ts'],
            transform: { '^.+\\.(ts|tsx)$': tsTransform, '^.+\\.(mjs|js)$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }] },
            ...common
        },
        {
            displayName: 'integration',
            testMatch: ['**/tests/integration/**/*.test.ts'],
            transform: { '^.+\\.(ts|tsx)$': tsTransform, '^.+\\.(mjs|js)$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }] },
            ...common
        }
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
    globalTeardown: '<rootDir>/tests/setup/globalTeardown.ts',
    testPathIgnorePatterns: ['/node_modules/', '/tests/unit/db/migrate.test.ts'],
    ...common
};

export default config;
