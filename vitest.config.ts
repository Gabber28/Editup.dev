import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.ts", "tests/security/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "landing/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**", "ai-bridge/**", "verification/**", "injected/**"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "**/types.ts"],
    },
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@bridge": path.resolve(__dirname, "ai-bridge"),
      "@verify": path.resolve(__dirname, "verification"),
      "@injected": path.resolve(__dirname, "injected"),
    },
  },
});
