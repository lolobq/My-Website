// @ts-check
/*
 * Home page: quote (typing), sculptor integration, scroll-tied story cards, Scroll to reveal,
 * Skip to Resume (journey 1), scroll-to-coffee (journey 2), sunset default, reduced motion,
 * JS disabled, fast scroll, resize / orientation change.
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
const SKIP = /skip to resume/i;

/**
 * Scroll top -> bottom in `steps` increments inside the page (one round trip in total, so it
 * stays fast when parallel workers compete for CPU), recording what `probe` returns at each
 * step: "active" (exposed card indices, same rule as helpers.activeCards) or "opacity"
 * (per-card effective opacity + whether the story has started).
 *
 * One animation frame per step is enough, and deterministic: an instant scrollTo queues the
 * scroll event for the next frame, which runs before that frame's rAF callbacks; js/scene.js
 * reads the scroll there and its frame() (registered a frame earlier than ours) applies the
 * cards before our callback reads them. Every 8th step re-reads one frame later to prove the
 * state had settled; any difference is returned in `unsettled` and must be empty.
 */
function walkInPage(page, steps, probe) {
  return page.evaluate(
    async ({ steps, probe, sel }) => {
      const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      const cards = () => [...document.querySelectorAll(sel)];
      const read = () => {
        if (probe === "active")
          return cards()
            .map((el, i) => ({ el, i }))
            .filter(({ el }) => !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true" && !el.closest("[inert],[aria-hidden='true']"))
            .map(({ i }) => i);
        return {
          started: window.scrollY > 6,
          op: cards().map((el) => {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            if (cs.visibility === "hidden" || cs.display === "none" || r.bottom <= 0 || r.top >= window.innerHeight) return 0;
            return parseFloat(cs.opacity);
          }),
        };
      };
      const rows = [];
      const unsettled = [];
      const t0 = performance.now();
      for (let k = 0; k <= steps; k++) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: Math.round((max * k) / steps), behavior: "instant" });
        await raf();
        const row = read();
        rows.push(row);
        if (k % 8 === 0) {
          await raf();
          const again = read();
          if (JSON.stringify(again) !== JSON.stringify(row)) unsettled.push(`step ${k}: ${JSON.stringify(row)} -> ${JSON.stringify(again)}`);
        }
      }
      return { rows, unsettled, ms: Math.round(performance.now() - t0) };
    },
    { steps, probe, sel: SEL.cards }
  );
}

/** Walk, assert every sampled step had settled after one frame, and return the per-step rows. */
async function walk(page, steps, probe) {
  const { rows, unsettled, ms } = await walkInPage(page, steps, probe);
  test.info().annotations.push({ type: "walk", description: `${probe} x${steps + 1} steps in ${ms}ms` });
  expect(unsettled, "card state changed one frame after the step was read (one-frame walk assumption)").toEqual([]);
  return rows;
}

/** Active card indices at each of `steps` + 1 scroll positions, top to bottom. */
const walkStory = (page, steps = 48) => walk(page, steps, "active");

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

  test("Scroll to reveal and Skip to Resume sit side by side under the sculptor", async ({ page }) => {
    await page.goto("/index.html");
    const hint = page.locator(SEL.scrollHint);
    const skip = page.getByRole("link", { name: SKIP });
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAccessibleName(/scroll to reveal/i);
    await expect(skip).toBeVisible();
    await expect(skip).toHaveAttribute("href", /resume\.html#document$/);
    await expect(skip).toHaveAttribute("id", "skip-to-work");
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
    const cta = cards.last().locator("a", { hasText: /Let.s Grab Coffee/ }); // CSS locator: card is aria-hidden at scroll 0
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
  // The 1440px garden canvas is CPU-heavy; with parallel workers these long journeys need
  // more than the default 30s budget on desktop. (In isolation they take 3-13s.)
  test.slow(({ isMobile }) => !isMobile, "desktop canvas under parallel load");
  test("journey 1: quote -> Skip to Resume -> resume PDF region -> Download PDF", async ({ page, request }) => {
    const errs = watchErrors(page);
    await page.goto("/index.html");
    await expect(page.locator("blockquote")).toContainText(QUOTE, { timeout: 15_000 });
    await page.getByRole("link", { name: SKIP }).click();
    await expect(page).toHaveURL(/resume\.html#document$/);
    await expect(page.locator(SEL.document)).toBeVisible();
    await expect(page.locator("#resume-dynamic, [data-view]"), "dynamic/document toggle is retired").toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe("resume-heading");
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

  test("journey 2: scroll through every card in order -> closing card -> Let's Grab Coffee opens calendar", async ({ page, context }) => {
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
    const cta = last.getByRole("link", { name: /Let.s Grab Coffee/ });
    await expect(cta).toBeVisible();
    await expect(cta).toBeInViewport();
    await expect(cta).toHaveAttribute("href", CALENDAR_URL);

    // The CTA opens in a new tab when target=_blank; wait for that tab without a short race.
    const newTab = (await cta.getAttribute("target")) === "_blank";
    const [popup] = await Promise.all([newTab ? context.waitForEvent("page") : Promise.resolve(null), cta.click()]);
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
    await expect(page.locator(SEL.cards).last().getByRole("link", { name: /Let.s Grab Coffee/ })).toBeInViewport();
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
    await expect(page.locator(SEL.cards).last().getByRole("link", { name: /Let.s Grab Coffee/ })).toBeInViewport();
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
    await expect(page.getByRole("link", { name: SKIP })).toBeVisible();
  });

  test("navigation links exist without JS", async ({ page }) => {
    await page.goto("/resume.html");
    await expect(page.locator(SEL.nav).first().locator("a")).not.toHaveCount(0);
  });

  test("resume: a working link to the PDF without JS", async ({ page, request }) => {
    await page.goto("/resume.html#document");
    const link = page.locator('main a[href$="assets/resume.pdf"]').first();
    await expect(link, "visible link to assets/resume.pdf without JS").toBeVisible();
    const res = await request.get(new URL((await link.getAttribute("href")) || "", page.url()).pathname);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] || "").toMatch(/pdf/);
  });

  test("contact: calendar link and email without JS", async ({ page }) => {
    await page.goto("/contact.html");
    await expect(page.locator(`a[href="${CALENDAR_URL}"]`).first()).toBeVisible();
    await expect(page.locator("main")).toContainText(/@/);
  });
});

test.describe("home: sunset is the default on every load", () => {
  const timeState = (page) =>
    page.evaluate(() => ({
      time: document.body.dataset.time,
      label: (document.querySelector("#time-toggle span") || {}).textContent,
      ls: (() => { try { return Object.keys(localStorage); } catch (e) { return ["<unavailable>"]; } })(),
    }));

  test("first load, after toggling + reload, and after back navigation", async ({ page }) => {
    await page.goto("/index.html");
    expect(await timeState(page)).toEqual({ time: "sunset", label: "Sunset", ls: [] });

    await page.locator("#time-toggle").click();
    const toggled = await timeState(page);
    expect(toggled.time, "toggle changes the time of day").not.toBe("sunset");
    expect(toggled.label).not.toBe("Sunset");
    expect(toggled.ls, "nothing persisted in localStorage").toEqual([]);

    await page.reload();
    expect(await timeState(page), "reload opens at sunset").toEqual({ time: "sunset", label: "Sunset", ls: [] });

    await page.locator("#time-toggle").click();
    await page.locator(SEL.nav).first().getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/about\.html/);
    await page.goBack();
    await expect(page).toHaveURL(/index\.html/);
    await expect.poll(() => timeState(page), { message: "back navigation (incl. bfcache) opens at sunset" }).toEqual({ time: "sunset", label: "Sunset", ls: [] });
  });
});

test.describe("home: scroll-tied story cards", () => {
  test.slow(({ isMobile }) => !isMobile, "desktop canvas under parallel load");
  test("opacity follows scroll continuously and there is no long empty stretch", async ({ page }) => {
    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    const STEPS = 120;
    const rows = (await walk(page, STEPS, "opacity")).map((r, k) => ({ k, ...r }));
    const story = rows.filter((r) => r.started);
    const empty = story.filter((r) => Math.max(...r.op) < 0.05).map((r) => r.k);
    expect(empty.length, `scroll steps (of ${story.length}) with no visible card: ${empty.join(",")}`).toBeLessThanOrEqual(1);

    // Continuous: many intermediate opacities, and no card snaps by more than ~0.7 per 1/120 step.
    const partial = story.flatMap((r) => r.op).filter((o) => o > 0.1 && o < 0.9).length;
    expect(partial, "intermediate (partial) card opacities observed while scrolling").toBeGreaterThanOrEqual(10);
    const jumps = [];
    for (let i = 1; i < story.length; i++)
      story[i].op.forEach((o, c) => {
        const d = Math.abs(o - story[i - 1].op[c]);
        if (d > 0.7) jumps.push(`card ${c} step ${story[i].k}: ${story[i - 1].op[c].toFixed(2)} -> ${o.toFixed(2)}`);
      });
    expect(jumps, "card opacity snaps between adjacent scroll steps").toEqual([]);
  });
});

test.describe("home: quote typing", () => {
  const FULL = "“Every block of stone has a statue inside it, and it is the task of the sculptor to discover it.”";
  const typedLen = (page) => page.evaluate(() => (document.querySelector("#quote .q-typed") || {}).textContent?.length || 0);

  /** Fake clock, paused from the first byte: time and rAF advance only through clock.runFor(). */
  const pausedClock = async (page) => {
    const t0 = new Date("2026-11-20T12:00:00Z");
    await page.clock.install({ time: t0 });
    await page.clock.pauseAt(new Date(t0.getTime() + 60_000)); // well ahead of the clock (about:blank has no timers)
  };

  // Desktop shares the CPU with other workers animating a 1440px canvas, so the timing below is
  // measured in the page (rAF samples, event-time reads), never across Playwright round trips.
  test.slow(({ isMobile }) => !isMobile, "desktop canvas under parallel load");

  test("types over about 3.1s", async ({ page }) => {
    // Sample the typed length every frame, in-page from document start (so a slow load can't
    // make us miss the beginning), from the first character to is-typed.
    await page.addInitScript((fullLen) => {
      const w = /** @type {any} */ (window);
      w.__typing = new Promise((resolve) => {
        const samples = [];
        let firstAt = 0, longFrames = 0, prev = 0;
        const tick = (now) => {
          const q = document.getElementById("quote");
          const n = q ? ((q.querySelector(".q-typed") || {}).textContent || "").length : 0;
          if (prev && now - prev > 50) longFrames++; // the typer caps each step at 50ms
          prev = now;
          if (n > 0 && !firstAt) firstAt = now;
          if (firstAt) samples.push(n);
          if (q && q.classList.contains("is-typed")) {
            resolve({ ms: firstAt ? now - firstAt : 0, samples, longFrames, done: n, startedPartial: samples.length > 0 && samples[0] < fullLen });
            return;
          }
          if (now > 30000) return resolve({ ms: -1, samples, longFrames, done: n, startedPartial: false });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, FULL.length);
    await page.goto("/index.html");
    const run = await page.evaluate(() => /** @type {any} */ (window).__typing);
    expect(run.startedPartial, "observed partway through typing (not already finished)").toBe(true);
    expect(run.done, "full quote typed").toBe(FULL.length);
    // ~3.1s of typing clock; the clock never runs ahead of real time, so it can't be much faster.
    expect(run.ms, "typing takes at least ~2.5s").toBeGreaterThan(2_500);
    // Long frames (> 50ms) slow the typer down by design; allow for them, but keep a hard ceiling.
    const ceiling = 5_500 + run.longFrames * 60;
    expect(run.ms, `typing finishes in ~3.1s (+ allowance for ${run.longFrames} long frames)`).toBeLessThan(Math.min(ceiling, 15_000));
    const lens = run.samples;
    const monotonic = lens.every((n, i) => i === 0 || n >= lens[i - 1]);
    expect(monotonic, "typed length never goes backwards").toBe(true);
    expect(new Set(lens).size, "many intermediate lengths (steady typing, not a burst)").toBeGreaterThan(30);
    expect(await page.locator("#quote .q-rest").textContent()).toBe("");
  });

  for (const how of ["scroll", "key"]) {
    test(`finishes immediately on ${how}`, async ({ page }) => {
      // Round trips to a loaded desktop page can take ~0.5s each, longer than the gap we need to
      // hit. So the page runs on Playwright's fake clock: time (and rAF) only moves when we say,
      // which makes "partially typed, then the event" exact instead of a race.
      await pausedClock(page);
      await page.goto("/index.html");
      await page.clock.runFor(1_000); // ~1s of typing: underway, not done
      const before = await typedLen(page);
      expect(before, "partially typed after 1s").toBeGreaterThan(0);
      expect(before).toBeLessThan(FULL.length);
      // Read the length inside the event, right after the site's own finish handler (registered
      // earlier on window, so it runs first), with no clock time passing.
      await page.evaluate((ev) => {
        const w = /** @type {any} */ (window);
        const q = document.getElementById("quote");
        w.__finish = new Promise((resolve) =>
          window.addEventListener(ev, () => resolve({ len: ((q.querySelector(".q-typed") || {}).textContent || "").length, typed: q.classList.contains("is-typed") }), { once: true, passive: true })
        );
      }, how === "scroll" ? "scroll" : "keydown");
      if (how === "scroll") {
        await page.evaluate(() => window.scrollTo(0, 40));
        await page.clock.runFor(20); // one frame for the scroll event to be dispatched
      } else await page.keyboard.press("Shift");
      const r = await page.evaluate(() => /** @type {any} */ (window).__finish);
      expect(r.len, `full quote in the same ${how} event`).toBe(FULL.length);
      expect(r.typed).toBe(true);
      await expect(page.locator("#quote")).toHaveClass(/is-typed/);
    });
  }

  test("without input the quote is still partial at 2s and done by 4s (fake clock)", async ({ page }) => {
    await pausedClock(page);
    await page.goto("/index.html");
    await page.clock.runFor(2_000);
    const mid = await typedLen(page);
    expect(mid, "partial at 2s").toBeGreaterThan(20);
    expect(mid).toBeLessThan(FULL.length);
    await expect(page.locator("#quote")).not.toHaveClass(/is-typed/);
    await page.clock.runFor(2_000);
    expect(await typedLen(page), "done by 4s").toBe(FULL.length);
    await expect(page.locator("#quote")).toHaveClass(/is-typed/);
  });

  test("reduced motion: full quote immediately", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/index.html");
    expect(await typedLen(page)).toBe(FULL.length);
    await expect(page.locator("#quote")).toHaveClass(/is-typed/);
  });
});
