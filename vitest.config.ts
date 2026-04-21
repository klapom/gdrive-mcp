import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/tools/**/*.ts", "src/config.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/test-helpers.ts",
        "src/index.ts",
        "src/http_server.ts",
        "src/auth.ts",
        "src/auth-cli.ts",
        "src/tools/context.ts",
        "src/tools/index.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
