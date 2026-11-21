// @ts-check
/*
 * Regression guard: compares every existing page against the pre-agent baseline in
 * tests/baseline/<project>/. Capture/refresh with `npm run test:baseline:update`
 * (only when a visual change has been reviewed and approved). Compare with
 * `npm run test:baseline`.
 *
 * Homepage: the garden scene is a fixed, animated canvas, so it is made deterministic
 * (prefers-reduced-motion, seeded Math.random, time of day forced to "day") and the
 * viewport is captured at 0/25/50/75/100% of the scrollable height. The sculptor
 * region (slab + figure) is also compared on its own, with a tighter tolerance, so
 * any change to the sculptor animation is flagged explicitly.
 */
const { test, expect } = require("@playwright/test");

const PAGES = ["about", "resume", "projects", "reflections", "speaking", "contact"];
const STEPS = [0, 25, 50, 75, 100];

// Tolerances. The full home viewport gets a generous allowance for canvas noise;
// the sculptor clip is held tighter.
const HOME_VIEWPORT = { maxDiffPixelRatio: 0.03, threshold: 0.25 };
const SCULPTOR = { maxDiffPixelRatio: 0.01, threshold: 0.2 };
const PAGE_FULL = { fullPage: true, maxDiffPixelRatio: 0.01, threshold: 0.2 };

async function settle(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForLoadState("networkidle");
}

/** Replace Math.random with a fixed-seed PRNG before any site script runs. */
async function seedRandom(page) {
  await page.addInitScript(() => {
    let s = 0x2f6b1a3d;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { localStorage.clear(); } catch (e) {}
  });
}

/** Bounding box of the sculptor (slab + Lauren) from the CSS vars scene.js sets in layout(). */
async function sculptorClip(page) {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const n = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    const top = n("--fig-top"), bottom = n("--fig-bottom"), half = n("--fig-half");
    const vw = window.innerWidth, vh = window.innerHeight;
    const pad = 8;
    const x = Math.max(0, vw / 2 - half - pad);
    const y = Math.max(0, top - pad);
    const width = Math.min(vw - x, half * 2 + pad * 2);
    const height = Math.min(vh - y, bottom - top + pad * 2);
    return { x, y, width, height };
  });
}

test.describe("baseline: homepage scene", () => {
  test("index at scroll 0/25/50/75/100%", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedRandom(page);
    await page.goto("/index.html");
    await page.waitForFunction(() => !!(window.__garden && window.__garden.setTime));
    await page.evaluate(() => window.__garden.setTime("day"));
    await settle(page);
    await expect(page.locator("#quote")).toHaveClass(/is-typed/);

    for (const pct of STEPS) {
      await page.evaluate((p) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: Math.round((max * p) / 100), behavior: "auto" });
      }, pct);
      await page.waitForTimeout(400);
      const tag = String(pct).padStart(3, "0");

      await expect.soft(page, `home viewport at ${pct}% scroll changed`).toHaveScreenshot(
        `home-scroll-${tag}.png`,
        HOME_VIEWPORT
      );

      const clip = await sculptorClip(page);
      await expect.soft(page, `SCULPTOR region at ${pct}% scroll changed; orchestrator must review`).toHaveScreenshot(
        `home-scroll-${tag}-sculptor.png`,
        { ...SCULPTOR, clip }
      );
    }
  });
});

test.describe("baseline: inner pages", () => {
  for (const name of PAGES) {
    test(`${name} full page`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await seedRandom(page);
      await page.goto(`/${name}.html`);
      await settle(page);
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot(`${name}.png`, PAGE_FULL);
    });
  }
});
