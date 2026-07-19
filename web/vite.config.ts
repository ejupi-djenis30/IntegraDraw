import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/IntegraDraw/",
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
