// @ts-check
/*
 * Home page: quote, sculptor integration, scroll story, Scroll to reveal, Skip to work
 * (journey 1), scroll-to-coffee (journey 2), reduced motion, JS disabled, fast scroll,
 * resize / orientation change.
 */
const { test, expect } = require("@playwright/test");
const {
  CALENDAR_URL,
  SEL,
  norm,
  watchErrors,
  expectNoErrors,
  scrollToPct,
  frames,
  activeCards,
  hasHorizontalScroll,
  smallTapTargets,
} = require("./helpers");

const QUOTE = /Every block of stone has a statue inside it, and it is the task of the sculptor to discover it/;
const EXPECTED_CARDS = 8; // prologue + 6 identity cards + closing card

/** Scroll top -> bottom in `steps` increments, recording active card indices at each step. */
async function walkStory(page, steps = 48) {
  const trace = [];
  for (let k = 0; k <= steps; k++) {
    await scrollToPct(page, (100 * k) / steps);
    await frames(page, 3);
    trace.push(await activeCards(page));
  }
  return trace;
}

test.describe("home: structure", () => {
  test("quote is a <blockquote> with figcaption attribution", async ({ page }) => {
    await page.goto("/index.html");
    const fig = page.locator("figure:has(blockquote)").first();
    await expect(fig.locator("blockquote")).toContainText(QUOTE);
    await expect(fig.locator("figcaption")).toContainText(/Michelangelo/);
  });

  test("visually hidden h1 present", async ({ page }) => {
    await page.goto("/index.html");
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    expect(norm(await h1.textContent())).not.toBe("");
    const box = await h1.boundingBox();
    expect(box && box.width * box.height <= 4, "h1 is visually hidden (sr-only)").toBe(true);
  });

  test("Scroll to reveal and Skip to work sit side by side under the sculptor", async ({ page }) => {
    await page.goto("/index.html");
    const hint = page.locator(SEL.scrollHint);
    const skip = page.getByRole("link", { name: /skip to work/i });
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAccessibleName(/scroll to reveal/i);
    await expect(skip).toBeVisible();
    await expect(skip).toHaveAttribute("href", /resume\.html#document$/);
    const a = await hint.boundingBox();
    const b = await skip.boundingBox();
    expect(a && b, "both buttons have a box").toBeTruthy();
    if (a && b) {
      const sameRow = Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < Math.max(a.height, b.height) / 2;
      expect(sameRow, "buttons are on one row").toBe(true);
    }
    // Under the sculptor: buttons start below the figure's top edge.
    const figTop = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fig-top")) || 0);
    if (a && figTop) expect(a.y, "buttons sit below the top of the sculptor").toBeGreaterThan(figTop);
  });

  test("music button removed", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#music-toggle, audio")).toHaveCount(0);
  });

  test("cards: prologue, 6 identity cards (alternating sides), closing card with coffee CTA", async ({ page }) => {
    await page.goto("/index.html");
    const cards = page.locator(SEL.cards);
    await expect(cards).toHaveCount(EXPECTED_CARDS);
    await expect(cards.first(), "first card is the prologue").toContainText(/prologue|statue|journey/i);
    const sides = await cards.evaluateAll((els) =>
      els.map((e) => (e.classList.contains("side-left") ? "L" : e.classList.contains("side-right") ? "R" : "?"))
    );
    const identity = sides.slice(1, 7);
    expect(identity.includes("?"), `identity cards have side-left/side-right: ${sides.join("")}`).toBe(false);
    for (let i = 1; i < identity.length; i++) expect(identity[i], `cards alternate sides: ${sides.join("")}`).not.toBe(identity[i - 1]);
    for (let i = 1; i <= 6; i++) await expect(cards.nth(i), `identity card ${i} format`).toContainText(/younger self/i);
    const cta = cards.last().locator("a", { hasText: /let.s grab coffee/i }); // CSS locator: card is aria-hidden at scroll 0
    await expect(cta).toHaveAttribute("href", CALENDAR_URL);
  });
});

test.describe("home: sculptor integration", () => {
  test("canvas renders, progresses with scroll, and does not block input", async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto("/index.html");
    const canvas = page.locator("canvas#scene");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box && box.width > 0 && box.height > 0).toBe(true);

    const sculptHash = async () =>
      page.evaluate(() => {
        const c = /** @type {HTMLCanvasElement} */ (document.getElementById("scene"));
        const cs = getComputedStyle(document.documentElement);
        const n = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
        const scale = c.width / c.clientWidth || 1;
        const top = n("--fig-top"), bottom = n("--fig-bottom"), half = n("--fig-half") || 60;
        const x = Math.max(0, Math.floor((c.clientWidth / 2 - half) * scale));
        const y = Math.max(0, Math.floor(top * scale));
        const w = Math.max(1, Math.floor(half * 2 * scale));
        const h = Math.max(1, Math.floor(((bottom || top + 200) - top) * scale));
        const d = c.getContext("2d").getImageData(x, y, w, h).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s = (s * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) | 0;
        return s;
      });
    await page.waitForTimeout(300);
    const h0 = await sculptHash();
    await scrollToPct(page, 60);
    await page.waitForTimeout(400);
    const h1 = await sculptHash();
    expect(h1, "sculptor region changes as the visitor scrolls").not.toBe(h0);

    await scrollToPct(page, 0);
    await page.waitForTimeout(300);
    const hit = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return "missing";
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top && (top === el || el.contains(top)) ? "ok" : `covered by ${top && top.tagName}`;
    }, SEL.scrollHint);
    expect(hit, "Scroll to reveal is clickable (canvas does not intercept input)").toBe("ok");
    expectNoErrors(errs, "home sculptor");
  });
});

test.describe("home: journeys", () => {
  test("journey 1: quote -> Skip to work -> resume document view -> Download PDF", async ({ page, request }) => {
    const errs = watchErrors(page);
    await page.goto("/index.html");
    await expect(page.locator("blockquote")).toContainText(QUOTE, { timeout: 15_000 });
    await page.getByRole("link", { name: /skip to work/i }).click();
    await expect(page).toHaveURL(/resume\.html#document$/);
    await expect(page.locator(SEL.document)).toBeVisible();
    await expect(page.locator(SEL.dynamic)).toBeHidden();
    const focused = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? { tag: a.tagName, text: (a.textContent || "").trim() } : null;
    });
    expect(focused && focused.tag, "focus lands on the resume heading").toMatch(/^H[1-3]$/);

    const pdf = page.getByRole("link", { name: /download pdf/i });
    await expect(pdf).toBeVisible();
    await expect(pdf).toHaveAttribute("download", /.*/);
    const href = (await pdf.getAttribute("href")) || "";
    expect(href).toMatch(/assets\/resume\.pdf$/);
    const res = await request.get(new URL(href, page.url()).pathname);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] || "").toMatch(/pdf/);

    const [download] = await Promise.all([page.waitForEvent("download"), pdf.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    expect(await download.failure()).toBeNull();
    expectNoErrors(errs, "journey 1");
  });

  test("journey 2: scroll through every card in order -> closing card -> Let's grab coffee opens calendar", async ({ page, context }) => {
    const errs = watchErrors(page);
    await context.route("https://calendar.app.google/**", (r) =>
      r.fulfill({ status: 200, contentType: "text/html", body: "<title>calendar stub</title>" })
    );
    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    const n = await page.locator(SEL.cards).count();
    expect(n, "story cards rendered").toBe(EXPECTED_CARDS);

    const trace = await walkStory(page);
    const firstSeen = Array.from({ length: n }, (_, i) => trace.findIndex((a) => a.includes(i)));
    expect(firstSeen.filter((s) => s < 0).length, `every card becomes active (first-seen step per card: ${firstSeen.join(",")})`).toBe(0);
    for (let i = 1; i < n; i++) {
      expect(firstSeen[i], `card ${i} activates after card ${i - 1} (steps ${firstSeen.join(",")})`).toBeGreaterThan(firstSeen[i - 1]);
    }
    expect(Math.max(...trace.map((a) => a.length)), "never more than 2 cards exposed at once").toBeLessThanOrEqual(2);
    expect(trace[0].length === 0 || trace[0][0] === 0, "at the top, only the prologue (or nothing) is exposed").toBe(true);

    // Every exposed card is actually on screen at the end; closing card CTA visible.
    const last = page.locator(SEL.cards).last();
    expect(await activeCards(page)).toContain(n - 1);
    await expect(last).toBeInViewport();
    const cta = last.getByRole("link", { name: /let.s grab coffee/i });
    await expect(cta).toBeVisible();
    await expect(cta).toBeInViewport();
    await expect(cta).toHaveAttribute("href", CALENDAR_URL);

    const popupP = context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
    await cta.click();
    const popup = await popupP;
    if (popup) {
      await popup.waitForLoadState();
      expect(popup.url()).toBe(CALENDAR_URL);
      await popup.close();
    } else {
      await expect(page).toHaveURL(CALENDAR_URL);
    }
    expectNoErrors(errs, "journey 2");
  });

  test("hidden cards are not focusable or exposed", async ({ page }) => {
    await page.goto("/index.html");
    for (const pct of [0, 30, 60, 100]) {
      await scrollToPct(page, pct);
      await frames(page, 3);
      const leaks = await page.$$eval(SEL.cards, (els) =>
        els
          .map((el, i) => {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            const offscreen = r.bottom <= 0 || r.top >= window.innerHeight || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05;
            const exposed = !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true";
            return offscreen && exposed ? `card ${i} is off-screen but not inert/aria-hidden` : null;
          })
          .filter(Boolean)
      );
      expect(leaks, `at ${pct}%`).toEqual([]);
      const ariaHiddenFocusable = await page.$$eval(SEL.cards, (els) =>
        els
          .filter((el) => el.getAttribute("aria-hidden") === "true" && !el.hasAttribute("inert"))
          .flatMap((el) => [...el.querySelectorAll("a[href],button,[tabindex]")].filter((f) => f.getAttribute("tabindex") !== "-1"))
          .map((f) => (f.textContent || "").trim().slice(0, 30))
      );
      expect(ariaHiddenFocusable, `focusable controls inside aria-hidden cards at ${pct}% (use inert)`).toEqual([]);
    }
  });

  test("Scroll to reveal scrolls to the prologue", async ({ page }) => {
    await page.goto("/index.html");
    await page.locator(SEL.scrollHint).click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 }).toBeGreaterThan(0);
    await expect.poll(() => activeCards(page), { timeout: 5_000 }).toContain(0);
    await expect(page.locator(SEL.cards).first()).toBeInViewport();
  });

  test("fast scrolling: jump to the end and back without errors", async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto("/index.html");
    for (const pct of [100, 0, 70, 10, 100]) {
      await scrollToPct(page, pct);
      await page.waitForTimeout(30);
    }
    await frames(page, 3);
    const n = await page.locator(SEL.cards).count();
    expect(await activeCards(page)).toEqual([n - 1]);
    await scrollToPct(page, 0);
    await frames(page, 3);
    await expect(page.locator("blockquote")).toBeVisible();
    expectNoErrors(errs, "fast scroll");
  });

  test("resize / orientation change keeps the story usable", async ({ page }, testInfo) => {
    const errs = watchErrors(page);
    await page.goto("/index.html");
    const orig = page.viewportSize() || { width: 375, height: 812 };
    await scrollToPct(page, 50);
    await page.setViewportSize({ width: orig.height, height: orig.width }); // rotate
    await frames(page, 3);
    await page.setViewportSize(orig);
    await frames(page, 3);
    await scrollToPct(page, 100);
    await frames(page, 3);
    await expect(page.locator(SEL.cards).last().getByRole("link", { name: /let.s grab coffee/i })).toBeInViewport();
    if (testInfo.project.name.includes("mobile")) expect(await hasHorizontalScroll(page)).toBe(false);
    expectNoErrors(errs, "resize");
  });

  test("closing card CTA meets tap target size", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only");
    await page.goto("/index.html");
    await scrollToPct(page, 100);
    await frames(page, 3);
    expect(await smallTapTargets(page), "controls < 44x44 at the closing card").toEqual([]);
  });
});

test.describe("home: reduced motion", () => {
  // Note: test.use({ reducedMotion }) does not take effect with this config's project
  // `use` (matchMedia stays false), so emulate explicitly before navigation.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("quote shows in full immediately and nothing animates", async ({ page }) => {
    await page.goto("/index.html");
    await page.waitForLoadState("load");
    await expect(page.locator("blockquote")).toContainText(QUOTE, { timeout: 1_000 });
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        // CSS animations (entrance pops, blinking caret, bobbing icons) must be off; short
        // CSS transitions tied to scroll state (opacity fades) are tolerated.
        .filter((a) => a.playState === "running" && a.constructor.name !== "CSSTransition")
        .map((a) => {
          const t = /** @type {any} */ (a.effect) && /** @type {any} */ (a.effect).target;
          const cls = t && t.getAttribute ? (t.getAttribute("class") || "").split(" ")[0] : "";
          return `${/** @type {any} */ (a).animationName || a.constructor.name} on ${t ? t.tagName.toLowerCase() + (cls ? "." + cls : "") : "?"}`;
        })
    );
    expect(running, "CSS animations/transitions running under reduced motion").toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).not.toBe("smooth");
  });

  test("every card is reachable and the closing CTA shows", async ({ page }) => {
    await page.goto("/index.html");
    const trace = await walkStory(page, 32);
    const n = await page.locator(SEL.cards).count();
    for (let i = 0; i < n; i++) expect(trace.some((a) => a.includes(i)), `card ${i} reachable under reduced motion`).toBe(true);
    await expect(page.locator(SEL.cards).last().getByRole("link", { name: /let.s grab coffee/i })).toBeInViewport();
  });
});

test.describe("JS disabled", () => {
  test.use({ javaScriptEnabled: false });

  test("home: quote readable and a path to the resume exists", async ({ page }) => {
    await page.goto("/index.html");
    const visibleQuote = await page.evaluate(() => {
      const bq = document.querySelector("blockquote");
      if (!bq) return false;
      return [...bq.querySelectorAll("*"), bq].some((el) => {
        const r = el.getBoundingClientRect();
        return /statue inside it/.test(el.textContent || "") && r.height > 10 && r.width > 50 && getComputedStyle(el).visibility !== "hidden";
      });
    });
    expect(visibleQuote, "quote visibly readable without JS").toBe(true);
    await expect(page.getByRole("link", { name: /skip to work/i })).toBeVisible();
  });

  test("navigation links exist without JS", async ({ page }) => {
    await page.goto("/resume.html");
    await expect(page.locator(SEL.nav).first().locator("a")).not.toHaveCount(0);
  });

  test("resume document view is real HTML without JS", async ({ page }) => {
    await page.goto("/resume.html#document");
    const text = norm(await page.locator(SEL.document).textContent().catch(() => ""));
    expect(text.length, "resume text present in static HTML").toBeGreaterThan(500);
  });

  test("contact: calendar link and email without JS", async ({ page }) => {
    await page.goto("/contact.html");
    await expect(page.locator(`a[href="${CALENDAR_URL}"]`).first()).toBeVisible();
    await expect(page.locator("main")).toContainText(/@/);
  });
});
