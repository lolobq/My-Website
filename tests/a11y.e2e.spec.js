// @ts-check
/*
 * @a11y: axe-core on every page, the home page at several scroll positions, and both
 * resume views. Target: zero violations (WCAG 2.0/2.1/2.2 A+AA plus axe best practices,
 * which cover heading order and landmarks that Lighthouse also scores).
 * "Incomplete" results (typically contrast over the canvas, which axe cannot compute)
 * are attached as annotations for manual review, not failures.
 */
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { PAGES, scrollToPct, frames } = require("./helpers");

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function audit(page, label, testInfo) {
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const fmt = (v) =>
    `${v.id} [${v.impact}] ${v.help}\n` +
    v.nodes.slice(0, 5).map((n) => `    ${n.target.join(" ")}  ${(n.failureSummary || "").split("\n")[1] || ""}`.trimEnd()).join("\n");
  const incomplete = res.incomplete.filter((v) => v.id === "color-contrast");
  if (incomplete.length) {
    testInfo.annotations.push({
      type: "axe-incomplete",
      description: `${label}: ${incomplete.map((v) => `${v.id} x${v.nodes.length}`).join(", ")} (needs manual contrast check)`,
    });
  }
  expect(res.violations.map(fmt), `axe violations on ${label}`).toEqual([]);
}

test.describe("@a11y axe", () => {
  for (const pg of PAGES.filter((p) => p.name !== "home" && p.name !== "resume")) {
    test(`${pg.name}`, async ({ page }, testInfo) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      await audit(page, pg.path, testInfo);
    });
  }

  for (const view of ["dynamic", "document"]) {
    test(`resume #${view}`, async ({ page }, testInfo) => {
      await page.goto(`/resume.html#${view}`);
      await page.waitForLoadState("networkidle");
      await audit(page, `resume.html#${view}`, testInfo);
    });
  }

  for (const pct of [0, 15, 35, 55, 75, 100]) {
    test(`home at ${pct}% scroll`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: "reduce" }); // settle cards instantly so contrast is measured at rest
      await page.goto("/index.html");
      await page.waitForLoadState("networkidle");
      await scrollToPct(page, pct);
      await frames(page, 3);
      await page.waitForTimeout(300);
      await audit(page, `index.html @ ${pct}%`, testInfo);
    });
  }
});
