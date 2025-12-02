module.exports = {
    parser: "@typescript-eslint/parser",
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    plugins: ["@typescript-eslint"],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
    },
    env: {
        node: true,
        es6: true
    },
    rules: {
        indent: ["error", 4],
        "max-len": ["error", { code: 120 }],
        "no-console": "warn",
        "@typescript-eslint/no-unused-vars": "error",
        "@typescript-eslint/explicit-function-return-type": "warn",
        "@typescript-eslint/no-explicit-any": "warn"
    }
}
