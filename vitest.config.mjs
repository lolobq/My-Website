import { defineConfig } from "vitest/config";

// Unit tests load the real pages and scripts into jsdom (see tests/unit/load-page.js).
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{js,mjs}"],
    environment: "node",
    testTimeout: 10_000,
  },
});
