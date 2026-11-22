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

    test("nav: labels and order; Reflections shown with POSTS empty; aria-current", async ({ page }) => {
      await page.goto(pg.path);
      const nav = page.locator(SEL.nav).first();
      await expect(nav).toBeVisible();
      const labels = (await nav.locator("a:visible").allInnerTexts()).map(norm);
      expect(labels, "visible nav labels in order").toEqual(NAV_ORDER);
      // Committed content ships with POSTS empty; Reflections still shows (Lauren's call).
      expect(await page.evaluate(() => { const P = /** @type {any} */ (window).POSTS; return Array.isArray(P) && P.length; }), "POSTS ships empty").toBe(0);
      const refl = nav.getByRole("link", { name: /^reflections$/i });
      await expect(refl, "Reflections in the nav even while POSTS is empty").toHaveCount(1);
      await expect(refl).toHaveAttribute("href", "reflections.html");
      await expect(nav.getByRole("link", { name: /writing/i })).toHaveCount(0);

      const current = nav.locator('a[aria-current="page"]');
      if (pg.nav) {
        await expect(current).toHaveCount(1);
        expect(norm(await current.innerText())).toBe(pg.nav);
      } else if (pg.name === "home") {
        await expect(current, "no nav item is current on the home page").toHaveCount(0);
      }
    });

    test("text on stone is ink, never the old brown #5e2a14", async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      const brown = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll(".stone, .stone *")) {
          const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && /\S/.test(n.textContent || ""));
          if (!hasText) continue;
          const c = getComputedStyle(el).color.replace(/\s/g, "");
          if (/^rgba?\(94,42,20(,1)?\)$/.test(c)) out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} "${(el.textContent || "").trim().slice(0, 30)}"`);
          if (out.length >= 10) break;
        }
        return out;
      });
      expect(brown, "text on .stone surfaces using the old brown (#5e2a14)").toEqual([]);
    });

    test("stone surfaces are marble, not the old 48px grain alone", async ({ page }) => {
      await page.goto(pg.path);
      const grainOnly = await page.$$eval(".stone", (els) =>
        els
          .filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.backgroundImage === "none") return false;
            // The old surface was one tiling grain layer at 48px; marble adds gloss + veins layers.
            return cs.backgroundSize.split(",").map((s) => s.trim()).every((s) => s === "48px 48px");
          })
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).join(".")}`)
      );
      expect(grainOnly, ".stone surfaces still painted with only the 48px grain").toEqual([]);
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

test.describe("header: no nav collisions (behaviour, no fixed heights)", () => {
  /** Boxes of the name/tagline and every visible nav link; pairs that overlap; links clipped or off-screen. */
  const headerProblems = (page) =>
    page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; };
      const label = (el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24);
      const parts = [
        ...[...document.querySelectorAll("#site-header .who > *")].filter(vis).map((el) => ({ el, name: `brand "${label(el)}"` })),
        ...[...document.querySelectorAll("#site-header nav a")].filter(vis).map((el) => ({ el, name: `nav "${label(el)}"` })),
      ].map((p) => ({ ...p, r: p.el.getBoundingClientRect() }));
      const out = [];
      const T = 0.5;
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        if (a.r.left < -T || a.r.right > vw + T) out.push(`${a.name} outside the viewport [${Math.round(a.r.left)}..${Math.round(a.r.right)}] of ${vw}`);
        if (a.name.startsWith("nav") && a.el.scrollWidth > a.el.clientWidth + 1) out.push(`${a.name} text clipped (${a.el.scrollWidth} > ${a.el.clientWidth})`);
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j];
          // The name and tagline stack inside one link, so only brand-vs-nav and nav-vs-nav pairs count.
          if (a.name.startsWith("brand") && b.name.startsWith("brand")) continue;
          const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (ox > T && oy > T) out.push(`${a.name} overlaps ${b.name} by ${Math.round(ox)}x${Math.round(oy)}`);
        }
      }
      // The visible label sits inside the bar. (On phones the 44px hit area may hang below the slim
      // bar by design; only the text has to stay on the slab.)
      const header = document.querySelector("#site-header .bar");
      const hb = header ? header.getBoundingClientRect() : null;
      for (const p of parts) {
        const range = document.createRange();
        range.selectNodeContents(p.el);
        const t = range.getBoundingClientRect();
        if (hb && (t.bottom > hb.bottom + T || t.top < hb.top - T)) out.push(`${p.name} text outside the header bar (${Math.round(t.top)}..${Math.round(t.bottom)} vs ${Math.round(hb.top)}..${Math.round(hb.bottom)})`);
      }
      // A nav hit area that hangs below the bar must not cover a control on the page.
      const navRects = parts.filter((p) => p.name.startsWith("nav")).map((p) => p.r);
      for (const c of document.querySelectorAll("main a[href], main button, main [tabindex='0']")) {
        if (!vis(c) || c.closest("[inert], dialog:not([open])")) continue;
        const r = c.getBoundingClientRect();
        if (navRects.some((n) => Math.min(n.right, r.right) - Math.max(n.left, r.left) > T && Math.min(n.bottom, r.bottom) - Math.max(n.top, r.top) > T))
          out.push(`a nav hit area covers page control "${label(c)}"`);
      }
      return out;
    });

  for (const pg of PAGES) {
    test(`${pg.name}: brand and nav links never collide`, async ({ page }, testInfo) => {
      const widths = testInfo.project.name.includes("mobile") ? [360, 375, 390] : [1024, 1440];
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: testInfo.project.name.includes("mobile") ? 740 : 900 });
        await page.goto(pg.path);
        await page.evaluate(() => document.fonts.ready);
        expect(await headerProblems(page), `${pg.name} at ${w}px`).toEqual([]);
        const small = (await smallTapTargets(page)).filter((s) => s.startsWith("a") || s.startsWith("button"));
        expect(small.filter((s) => /^a\b/.test(s)), `${pg.name} at ${w}px: nav tap targets under 44x44`).toEqual([]);
      }
    });
  }
});

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
