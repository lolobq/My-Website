// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Shared viewports (CLAUDE.md: mobile-first, 375px and desktop).
const MOBILE = {
  ...devices["Desktop Chrome"],
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
};
const DESKTOP = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
};
const STABLE = { locale: "en-US", timezoneId: "America/New_York", colorScheme: "light" };

module.exports = defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  // Baselines live in tests/baseline/<project>/<name>.png (no OS/browser suffix:
  // the baseline is captured with Chromium only).
  snapshotPathTemplate: "{testDir}/baseline/{projectName}/{arg}{ext}",
  // Set BASELINE_UPDATE=1 (npm run test:baseline:update) to re-capture. Otherwise a
  // missing baseline image is a failure, never silently created.
  updateSnapshots: process.env.BASELINE_UPDATE ? "all" : "none",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.2,
      maxDiffPixelRatio: 0.01,
    },
  },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    ...STABLE,
  },

  projects: [
    // Regression guard against the pre-agent baseline (tests/baseline.spec.js).
    { name: "baseline-mobile", testMatch: /baseline\.spec\.js$/, use: { ...MOBILE, ...STABLE } },
    { name: "baseline-desktop", testMatch: /baseline\.spec\.js$/, use: { ...DESKTOP, ...STABLE } },

    // Functional e2e / accessibility specs (*.e2e.spec.js), added in later runs.
    { name: "mobile", testMatch: /\.e2e\.spec\.js$/, use: { ...MOBILE, ...STABLE } },
    { name: "desktop", testMatch: /\.e2e\.spec\.js$/, use: { ...DESKTOP, ...STABLE } },

    // Cross-browser (WebKit mobile, Firefox desktop). Opt-in with CROSS_BROWSER=1
    // (npm run test:e2e:cross) after `npx playwright install webkit firefox`.
    ...(process.env.CROSS_BROWSER
      ? [
          {
            name: "webkit-mobile",
            testMatch: /\.e2e\.spec\.js$/,
            use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 }, browserName: /** @type {const} */ ("webkit"), ...STABLE },
          },
          {
            name: "firefox-desktop",
            testMatch: /\.e2e\.spec\.js$/,
            use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 }, ...STABLE },
          },
        ]
      : []),
  ],

  webServer: {
    command: `npx http-server . -p ${PORT} -a 127.0.0.1 -c-1 --silent`,
    url: `${BASE_URL}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
