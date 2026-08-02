import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // Every test boots a real WebGL scene, and headless Chromium rasterises on
  // the CPU. Playwright's default worker count saturates the machine, and a
  // starved render loop stops answering the test protocol long before it stops
  // drawing — which surfaces as unrelated timeouts all over the suite.
  workers: process.env.CI ? 1 : 2,
  // The save test boots the reef twice and swims a full discovery in between.
  // Playwright's generic 30s default is tight for that once the scene is being
  // rasterised on the CPU; this is headroom, not an expectation.
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
