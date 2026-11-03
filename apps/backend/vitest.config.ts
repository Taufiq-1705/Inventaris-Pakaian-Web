import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Guarantees src/index.ts never calls app.listen() during tests
    env: { NODE_ENV: "test" },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: [
        "src/lib/businessRules.ts",
        "src/lib/transactionService.ts",
        "src/routes/outgoing.ts",
        "src/middleware/auth.ts",
        "src/middleware/errorHandler.ts",
      ],
    },
  },
});
