// @ts-check
/*
 * Site-wide checks that apply to every page (journeys 4 and 5 in qa.md, plus nav,
 * skip link and metadata contract from CLAUDE.md).
 */
const { test, expect } = require("@playwright/test");
const {
  PAGES,
  NAV_ORDER,
  SEL,
  norm,
  watchErrors,
  expectNoErrors,
  scrollToPct,
  frames,
  hasHorizontalScroll,
  overflowCulprits,
  smallTapTargets,
} = require("./helpers");

for (const pg of PAGES) {
  test.describe(`page: ${pg.name}`, () => {
    test("no console errors, no failed requests, no broken images", async ({ page }) => {
      const errs = watchErrors(page);
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      // Walk the page so lazy media and scroll-linked content load too.
      for (const pct of [25, 50, 75, 100]) {
        await scrollToPct(page, pct);
        await page.waitForTimeout(150);
      }
      await page.waitForLoadState("networkidle");
      const broken = await page.$$eval("img", (imgs) =>
        imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute("src")).map((i) => i.getAttribute("src"))
      );
      expect(broken, "broken <img> elements").toEqual([]);
      expectNoErrors(errs, pg.path);
    });

    test("meta: title, description, Open Graph, favicon", async ({ page, request }) => {
      await page.goto(pg.path);
      await expect(page).toHaveTitle(/\S/);
      const meta = async (sel) => (await page.locator(sel).first().getAttribute("content").catch(() => null)) || "";
      expect(norm(await meta('meta[name="description"]')), "meta description").not.toBe("");
      expect(norm(await meta('meta[property="og:title"]')), "og:title").not.toBe("");
      expect(norm(await meta('meta[property="og:description"]')), "og:description").not.toBe("");
      const ogImage = await meta('meta[property="og:image"]');
      expect(ogImage, "og:image").not.toBe("");
      // If absolute (production domain), check the same path locally.
      const ogPath = new URL(ogImage, page.url()).pathname;
      expect((await request.get(ogPath)).status(), `og:image ${ogImage} reachable`).toBe(200);

      const icon = page.locator('link[rel~="icon"]').first();
      await expect(icon, "favicon <link rel=icon>").toHaveCount(1);
      const iconHref = (await icon.getAttribute("href")) || "";
      expect((await request.get(new URL(iconHref, page.url()).pathname)).status(), `favicon ${iconHref}`).toBe(200);
    });

    test("nav: labels and order; Writing hidden; aria-current", async ({ page }) => {
      await page.goto(pg.path);
      const nav = page.locator(SEL.nav).first();
      await expect(nav).toBeVisible();
      const labels = (await nav.locator("a:visible").allInnerTexts()).map(norm);
      expect(labels, "visible nav labels in order").toEqual(NAV_ORDER);
      await expect(nav.getByRole("link", { name: /writing|reflections/i }), "Writing hidden while POSTS is empty").toHaveCount(0);

      const current = nav.locator('a[aria-current="page"]');
      if (pg.nav) {
        await expect(current).toHaveCount(1);
        expect(norm(await current.innerText())).toBe(pg.nav);
      } else if (pg.name === "home") {
        await expect(current, "no nav item is current on the home page").toHaveCount(0);
      }
    });

    test("one h1 and a working skip link", async ({ page, browserName }) => {
      await page.goto(pg.path);
      await expect(page.locator("h1"), "exactly one h1").toHaveCount(1);

      // WebKit only tabs to links when the 'tab to links' preference is on.
      test.skip(browserName === "webkit", "WebKit does not tab to links by default");
      await page.keyboard.press("Tab");
      const first = await page.evaluate(() => {
        const a = document.activeElement;
        return a && a.tagName === "A" ? { text: a.textContent || "", href: a.getAttribute("href") || "" } : null;
      });
      expect(first, "first Tab stop is a link").not.toBeNull();
      expect(norm(first && first.text), "first Tab stop is a skip link").toMatch(/skip/i);
      expect(first && first.href, "skip link targets an in-page anchor").toMatch(/^#./);
      const id = (first && first.href.slice(1)) || "";
      await expect(page.locator(`[id="${id}"]`), `skip link target #${id} exists`).toHaveCount(1);
      await expect(page.locator(":focus"), "skip link is visible when focused").toBeInViewport();
    });
  });
}

test.describe("mobile 375px layout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only");
  });

  for (const pg of PAGES) {
    test(`${pg.name}: no horizontal scroll`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      const steps = pg.name === "home" ? [0, 20, 40, 60, 80, 100] : [0];
      for (const pct of steps) {
        await scrollToPct(page, pct);
        await frames(page);
        const over = await hasHorizontalScroll(page);
        expect(over, `horizontal scroll at ${pct}%: ${(await overflowCulprits(page)).join(", ")}`).toBe(false);
      }
    });

    test(`${pg.name}: tap targets >= 44x44`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      const small = await smallTapTargets(page);
      expect(small, "controls smaller than 44x44 CSS px").toEqual([]);
    });
  }
});
