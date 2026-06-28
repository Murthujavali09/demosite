import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  reporter: [["list"]],
});
