// @ts-check
/*
 * Resume (just the PDF), Projects (stone tiles + dialogs, journey 6), Reflections (tags, filter,
 * fixture posts), Coffee page, keyboard-only journey (journey 3).
 */
const { test, expect } = require("@playwright/test");
const { CALENDAR_URL, SEL, NAV_ORDER, norm, watchErrors, expectNoErrors, injectPosts, FIXTURE_POSTS } = require("./helpers");

/** Headless Chromium has no PDF viewer; pretend it does so the desktop embed path runs. */
const forcePdfViewer = (page) =>
  page.addInitScript(() => Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", { get: () => true, configurable: true }));

test.describe("resume (just the PDF)", () => {
  /** Is the element visually hidden the .sr-only way (1x1 box or clipped)? */
  const srOnly = (loc) =>
    loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (r.width <= 1 && r.height <= 1) || (cs.clip !== "auto" && cs.clip !== "" && cs.overflow === "hidden");
    });
  /** Is the element really painted (box, not sr-only, not hidden)? */
  const painted = (loc) =>
    loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none";
    });

  test("dynamic/document toggle is retired", async ({ page }) => {
    await page.goto("/resume.html");
    await expect(page.locator("#resume-dynamic, #dynamic, [data-view]")).toHaveCount(0);
    await expect(page.locator(SEL.document)).toBeVisible();
  });

  test("retired pieces are gone: button bar, Open in new tab, <details> text version", async ({ page }) => {
    await page.goto("/resume.html");
    await expect(page.locator(".resume-actions, .resume-head, details.resume-text, main details")).toHaveCount(0);
    await expect(page.locator("main").getByRole("link", { name: /open in new tab/i })).toHaveCount(0);
  });

  test("fallback slab: Open my resume (PDF) in a new tab and Download PDF; PDF is served", async ({ page, request }) => {
    await page.goto("/resume.html"); // headless Chromium has no PDF viewer, so the slab shows everywhere
    const slab = page.locator(SEL.resumeFallback);
    await expect(slab).toHaveCount(1);
    await expect(slab).toHaveClass(/\bstone\b/);
    await expect(slab).toBeVisible();
    const open = slab.getByRole("link", { name: /^open my resume \(pdf\)$/i });
    const dl = slab.getByRole("link", { name: /^download pdf$/i });
    await expect(open).toHaveAttribute("href", /assets\/resume\.pdf$/);
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", /noopener/);
    await expect(dl).toHaveAttribute("href", /assets\/resume\.pdf$/);
    await expect(dl).toHaveAttribute("download", /.*/);
    expect(await slab.locator("a").count(), "exactly the two links in the slab").toBe(2);
    const res = await request.get(new URL((await dl.getAttribute("href")) || "", page.url()).pathname);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] || "").toMatch(/pdf/);
  });

  test("desktop with a PDF viewer: only the iframe, in a stone frame, no page scroll at 1440x900", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "desktop-only");
    await forcePdfViewer(page);
    const errs = watchErrors(page);
    page.on("download", () => {}); // headless saves the framed PDF as a download; that is fine
    await page.goto("/resume.html#document");
    const frame = page.locator(`${SEL.document} iframe`);
    await expect(frame, "PDF embed present on desktop").toHaveCount(1);
    await expect(frame).toHaveAttribute("src", /^assets\/resume\.pdf(#|$)/);
    await expect(frame).toHaveAttribute("title", /\S/);
    await expect(frame).toBeVisible();
    expect(await frame.evaluate((f) => !!f.closest(".stone")), "iframe sits inside a stone frame").toBe(true);

    // Nothing else is painted in main: no visible heading, buttons, links or text version.
    await expect(page.locator(SEL.resumeFallback)).toBeHidden();
    expect(await srOnly(page.locator("#resume-heading")), "h1 is sr-only").toBe(true);
    expect(await srOnly(page.locator(SEL.resumeText)), "text version is sr-only").toBe(true);
    const paintedInMain = await page.$$eval("main h1, main h2, main h3, main p, main a, main button, main li", (els) =>
      els
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && !el.closest(".sr-only, noscript");
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 30)}"`)
    );
    expect(paintedInMain, "visible text or controls besides the PDF").toEqual([]);

    const sizes = await page.evaluate(() => ({
      sh: document.documentElement.scrollHeight,
      ih: window.innerHeight,
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    }));
    expect(sizes.sh, `no vertical page scroll at 1440x900 (scrollHeight ${sizes.sh}, viewport ${sizes.ih})`).toBeLessThanOrEqual(sizes.ih + 1);
    expect(sizes.sw).toBeLessThanOrEqual(sizes.iw + 1);

    // Shrinking below the breakpoint removes the frame and brings the slab back.
    await page.setViewportSize({ width: 600, height: 900 });
    await expect(frame).toHaveCount(0);
    await expect(page.locator(SEL.resumeFallback)).toBeVisible();
    expectNoErrors(errs, "resume desktop embed");
  });

  test("desktop without a PDF viewer: no iframe, the slab instead", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "desktop-only");
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", { get: () => false, configurable: true }));
    await page.goto("/resume.html");
    await expect(page.locator(`${SEL.document} iframe`)).toHaveCount(0);
    await expect(page.locator(SEL.resumeFallback)).toBeVisible();
    await expect(page.locator(SEL.resumeFallback).getByRole("link", { name: /download pdf/i })).toBeVisible();
  });

  test("phone / touch: no iframe, one centred slab, both links 44px+", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only");
    await forcePdfViewer(page); // even with a viewer, touch/narrow screens get no frame
    await page.goto("/resume.html#document");
    await expect(page.locator("iframe, embed, object"), "no PDF embed on narrow/touch screens").toHaveCount(0);
    const slab = page.locator(SEL.resumeFallback);
    await expect(slab).toHaveCount(1);
    await expect(slab).toBeVisible();
    const box = await slab.boundingBox();
    const vw = (page.viewportSize() || { width: 0 }).width;
    expect(box, "slab has a box").not.toBeNull();
    if (box) {
      const off = Math.abs(box.x + box.width / 2 - vw / 2);
      expect(off, `slab centred (x ${Math.round(box.x)}, w ${Math.round(box.width)}, vw ${vw})`).toBeLessThanOrEqual(2);
    }
    for (const name of [/^open my resume \(pdf\)$/i, /^download pdf$/i]) {
      const b = await slab.getByRole("link", { name }).boundingBox();
      expect(b && b.height >= 44 && b.width >= 44, `${name} is a big tap target (${b && Math.round(b.width)}x${b && Math.round(b.height)})`).toBe(true);
    }
    expect(await srOnly(page.locator("#resume-heading")), "no visible heading on phones either").toBe(true);
  });

  test("text version: sr-only <article>, 500+ chars, links out of the Tab order", async ({ page }) => {
    await page.goto("/resume.html");
    const text = page.locator(SEL.resumeText);
    await expect(text).toHaveCount(1);
    expect(await text.evaluate((el) => el.tagName)).toBe("ARTICLE");
    await expect(text).toHaveClass(/\bsr-only\b/);
    expect(await srOnly(text), "visually hidden").toBe(true);
    expect(norm(await text.textContent()).length, "real HTML resume text").toBeGreaterThan(500);
    await expect(text.getByRole("heading", { name: /experience/i })).toHaveCount(1);
    const links = await text.locator("a").evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href"), ti: a.getAttribute("tabindex") })));
    expect(links.filter((l) => l.ti !== "-1"), "text-version links reachable by Tab (focus would go invisible)").toEqual([]);
  });

  test("print shows the text version and hides the PDF region", async ({ page }) => {
    await page.goto("/resume.html");
    await page.emulateMedia({ media: "print" });
    const text = page.locator(SEL.resumeText);
    await expect(text).toBeVisible();
    expect(await painted(text), "text version painted in print").toBe(true);
    expect(await srOnly(text), "no longer clipped in print").toBe(false);
    const box = await text.boundingBox();
    expect(box && box.width > 200 && box.height > 200, `text version laid out in print (${box && Math.round(box.width)}x${box && Math.round(box.height)})`).toBe(true);
    await expect(page.locator(SEL.document)).toBeHidden();
    await expect(text.getByRole("heading", { name: /experience/i })).toBeVisible();
  });

  test("resume.html#document focuses the sr-only resume heading", async ({ page }) => {
    await page.goto("/resume.html#document");
    await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe("resume-heading");
    expect(await page.evaluate(() => document.activeElement && document.activeElement.tagName)).toBe("H1");
    expect(await srOnly(page.locator("#resume-heading")), "heading is sr-only").toBe(true);
    await expect(page.locator("#resume-heading")).toHaveText(/\S/);
  });

  test("noscript fallback links are unchanged", async ({ request }) => {
    // pages.js replaces #resume, so read the shipped markup rather than the live DOM.
    const raw = await (await request.get("/resume.html")).text();
    const m = raw.match(/<div id="resume"[^>]*>\s*<noscript>([\s\S]*?)<\/noscript>/);
    expect(m, "#resume starts with a <noscript> fallback").not.toBeNull();
    const html = (m && m[1]) || "";
    expect(html).toContain('<a class="btn btn-link" href="assets/resume.pdf" download>Download PDF</a>');
    expect(html).toContain('<a class="btn" href="assets/resume.pdf" target="_blank" rel="noopener">Open in new tab</a>');
  });
});

test.describe("projects", () => {
  const TILE_KEYS = ["smartcity", "capstone", "stealth-ai-startup", "job-search-agent-mcp-server"];
  const tileLinks = (page) => page.locator(".tiles > li.tile a.tile-link");

  /** A viewport point that hits the open dialog element itself (its backdrop), or null. */
  const backdropPoint = (page) =>
    page.evaluate(() => {
      const d = document.querySelector("dialog[open]");
      const w = window.innerWidth, h = window.innerHeight;
      for (const [x, y] of [[3, 3], [w - 3, 3], [3, h - 3], [w - 3, h - 3], [w / 2, 3], [w / 2, h - 3]])
        if (document.elementFromPoint(x, y) === d) return { x, y };
      return null;
    });

  test("four stone tiles in TILE_KEYS order, plus an Also exploring link", async ({ page }) => {
    await page.goto("/projects.html");
    await expect(page.locator(".tiles > li.tile")).toHaveCount(4);
    const hrefs = await tileLinks(page).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(TILE_KEYS.map((k) => `#${k}`));
    await expect(page.getByRole("heading", { name: /smartcity/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /capstone/i }).first()).toBeVisible();
    const also = page.locator(".also");
    await expect(also).toContainText(/also exploring/i);
    await expect(also.locator("a[data-panel]")).not.toHaveCount(0);
  });

  test("old On the workbench section is gone", async ({ page }) => {
    await page.goto("/projects.html");
    await expect(page.getByRole("heading", { name: /on the workbench/i })).toHaveCount(0);
  });

  test("tile opens a modal dialog; focus moves in; Esc closes and focus returns", async ({ page }) => {
    await page.goto("/projects.html");
    const link = tileLinks(page).nth(1);
    await link.click();
    const dlg = page.locator("dialog#capstone");
    await expect(dlg).toHaveAttribute("open", "");
    expect(await dlg.evaluate((d) => d.matches(":modal")), "opened with showModal()").toBe(true);
    await expect(page).toHaveURL(/#capstone$/);
    expect(await dlg.evaluate((d) => d.contains(document.activeElement)), "focus moved into the dialog").toBe(true);
    await expect(dlg.getByRole("heading", { level: 2 })).toContainText(/capstone/i);
    await page.keyboard.press("Escape");
    await expect(dlg).not.toHaveAttribute("open", "");
    await expect(link).toBeFocused();
    await expect(page).not.toHaveURL(/#capstone/);
  });

  test("Close button and backdrop click close the dialog; focus returns", async ({ page }) => {
    await page.goto("/projects.html");
    const link = tileLinks(page).first();
    await link.click();
    const dlg = page.locator("dialog#smartcity");
    await expect(dlg).toHaveAttribute("open", "");
    await dlg.getByRole("button", { name: "Close" }).click();
    await expect(dlg).not.toHaveAttribute("open", "");
    await expect(link).toBeFocused();

    await link.click();
    await expect(dlg).toHaveAttribute("open", "");
    const pt = await backdropPoint(page);
    expect(pt, "some point of the viewport is backdrop (dialog does not cover every edge)").not.toBeNull();
    if (pt) await page.mouse.click(pt.x, pt.y);
    await expect(dlg).not.toHaveAttribute("open", "");
    await expect(link).toBeFocused();
  });

  test("#hash deep link opens its panel on load", async ({ page }) => {
    await page.goto("/projects.html#stealth-ai-startup");
    const dlg = page.locator("dialog#stealth-ai-startup");
    await expect(dlg).toHaveAttribute("open", "");
    await expect(page.locator(".tiles")).not.toHaveClass(/is-entering/);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
  });

  test("back closes a panel opened from a tile; forward reopens it", async ({ page }) => {
    await page.goto("/projects.html");
    await tileLinks(page).nth(1).click();
    const dlg = page.locator("dialog#capstone");
    await expect(dlg).toHaveAttribute("open", "");
    await page.goBack();
    await expect(dlg).not.toHaveAttribute("open", "");
    await expect(page).toHaveURL(/projects\.html$/);
    await page.goForward();
    await expect(dlg).toHaveAttribute("open", "");
  });

  test("Also exploring link opens its panel", async ({ page }) => {
    await page.goto("/projects.html");
    const a = page.locator(".also a[data-panel]").first();
    const key = await a.getAttribute("data-panel");
    await a.click();
    await expect(page.locator(`dialog[id="${key}"]`)).toHaveAttribute("open", "");
  });

  test("journey 6: workbench panels render a clean media placeholder", async ({ page }) => {
    await page.goto("/projects.html");
    const keys = await page.locator("dialog.project-panel:has(.wb-detail)").evaluateAll((ds) => ds.map((d) => d.id));
    expect(keys.length, "workbench panels exist").toBeGreaterThan(0);
    for (const key of keys) {
      await page.goto(`/projects.html#${key}`);
      const dlg = page.locator(`dialog[id="${key}"]`);
      await expect(dlg).toHaveAttribute("open", "");
      const slot = await dlg.locator(".wb-media").evaluate((el) => {
        const r = el.getBoundingClientRect();
        const brokenImg = [...el.querySelectorAll("img")].some((im) => im.complete && im.naturalWidth === 0);
        const bareVideo = [...el.querySelectorAll("video")].some((v) => !v.getAttribute("poster") && !v.querySelector("source[src]"));
        const ph = el.querySelector(".wb-placeholder");
        return { h: r.height, brokenImg, bareVideo, phLabel: ph ? ph.getAttribute("aria-label") : "n/a" };
      });
      expect(slot.h, `${key}: media slot has height`).toBeGreaterThan(40);
      expect(slot.brokenImg, `${key}: broken image`).toBe(false);
      expect(slot.bareVideo, `${key}: video without poster/src`).toBe(false);
      expect(norm(slot.phLabel), `${key}: placeholder has an accessible label`).not.toBe("");
    }
  });

  test.describe("entrance typing", () => {
    // Desktop shares the CPU with workers animating 1440px canvases, and round trips can take
    // ~0.5s, longer than the ~2s entrance. So the page runs on Playwright's fake clock, paused
    // from the first byte: time (and rAF) only moves through clock.runFor().
    test.slow(({ isMobile }) => !isMobile, "desktop canvas under parallel load");
    const untyped = (page) => page.$$eval(".tiles .tw-rest", (els) => els.filter((e) => e.textContent).length);
    const pausedClock = async (page) => {
      const t0 = new Date("2026-11-20T12:00:00Z");
      await page.clock.install({ time: t0 });
      await page.clock.pauseAt(new Date(t0.getTime() + 60_000)); // well ahead (about:blank has no timers)
    };

    for (const how of ["scroll", "key", "tap"]) {
      test(`finishes at once on ${how}`, async ({ page }) => {
        await pausedClock(page);
        await page.goto("/projects.html");
        await page.clock.runFor(300); // first slab partway through typing
        expect(await untyped(page), "still typing 300ms in").toBeGreaterThan(0);
        await expect(page.locator(".tiles")).toHaveClass(/is-entering/);
        // Read the state inside the event, right after the site's own finish handler (registered
        // earlier on window, so it runs first), with no clock time passing.
        const ev = how === "scroll" ? "wheel" : how === "key" ? "keydown" : "pointerdown";
        await page.evaluate((type) => {
          const w = /** @type {any} */ (window);
          w.__finish = new Promise((resolve) =>
            window.addEventListener(
              type,
              () =>
                resolve({
                  untyped: [...document.querySelectorAll(".tiles .tw-rest")].filter((e) => e.textContent).length,
                  entering: document.querySelector(".tiles").classList.contains("is-entering"),
                }),
              { once: true, passive: true }
            )
          );
        }, ev);
        if (how === "scroll") await page.mouse.wheel(0, 50);
        else if (how === "key") await page.keyboard.press("Shift");
        else {
          const h = await page.locator(".projects-head h1").boundingBox();
          expect(h, "heading to tap").not.toBeNull();
          if (h) await page.mouse.click(h.x + 5, h.y + h.height / 2);
        }
        const r = await page.evaluate(() => /** @type {any} */ (window).__finish);
        expect(r, `all text typed and entrance over within the same ${ev} event`).toEqual({ untyped: 0, entering: false });
        expect(await untyped(page)).toBe(0);
        await expect(page.locator("dialog[open]"), "tapping the heading opens no dialog").toHaveCount(0);
      });
    }

    test("finishes on its own: partial at 0.5s, done by 3s (fake clock)", async ({ page }) => {
      await pausedClock(page);
      await page.goto("/projects.html");
      await page.clock.runFor(500);
      expect(await untyped(page), "still typing at 0.5s").toBeGreaterThan(0);
      await page.clock.runFor(2_500);
      expect(await untyped(page), "all typed by 3s").toBe(0);
      await expect(page.locator(".tiles")).not.toHaveClass(/is-entering/);
    });

    test("reduced motion: shows immediately", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/projects.html");
      expect(await untyped(page)).toBe(0);
      await expect(page.locator(".tiles")).not.toHaveClass(/is-entering/);
    });
  });
});

test.describe("reflections", () => {
  const pressed = (page) =>
    page.$$eval(".tag-filter button", (bs) => bs.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent.trim()));

  test("empty: nav still shows Reflections (current), filter buttons, All pressed, empty state", async ({ page }) => {
    await page.goto("/reflections.html");
    const nav = page.locator(SEL.nav).first();
    expect((await nav.locator("a:visible").allInnerTexts()).map(norm)).toEqual(NAV_ORDER);
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Reflections");
    const labels = await page.locator(".tag-filter button").allInnerTexts();
    expect(labels.map(norm)).toEqual(["All", "Tech", "Philosophy", "Health & Wellness", "Communication"]);
    await expect(page.locator(".tag-filter")).toHaveAttribute("role", "group");
    expect(await pressed(page)).toEqual(["All"]);
    await expect(page.locator(".post-empty")).toContainText(/no reflections yet/i);
  });

  test("empty: ?tag= deep link presses that filter and shows a tag empty state", async ({ page }) => {
    await page.goto("/reflections.html?tag=philosophy");
    expect(await pressed(page)).toEqual(["Philosophy"]);
    await expect(page.locator(".post-empty")).toContainText(/nothing tagged philosophy/i);
    await expect(page.locator(".post-empty a")).toHaveAttribute("href", "reflections.html");
  });

  test("unknown ?tag= falls back to All", async ({ page }) => {
    await page.goto("/reflections.html?tag=nope");
    expect(await pressed(page)).toEqual(["All"]);
  });

  test.describe("with fixture posts", () => {
    test.beforeEach(async ({ page }) => {
      await injectPosts(page, FIXTURE_POSTS);
    });

    test("nav shows Reflections after About; list newest first", async ({ page }) => {
      await page.goto("/reflections.html");
      const labels = (await page.locator(SEL.nav).first().locator("a:visible").allInnerTexts()).map(norm);
      expect(labels).toEqual(["Resume", "Projects", "About", "Reflections", "Speaking", "Let's Get Coffee"]);
      await expect(page.locator(SEL.nav).first().locator('a[aria-current="page"]')).toHaveText("Reflections");
      await expect(page.locator(".post-list .post-link")).toHaveText(["Shipping my first agent", "On carving"]);
      await expect(page.locator(".post-card").first().locator("time")).toHaveAttribute("datetime", "2026-11-10");
      await expect(page.locator(".post-card").first()).toContainText(/min read/);
    });

    test("filter buttons: aria-pressed, ?tag= URL, back/forward", async ({ page }) => {
      await page.goto("/reflections.html");
      await page.locator(".tag-filter button", { hasText: "Tech" }).click();
      await expect(page).toHaveURL(/reflections\.html\?tag=tech$/);
      expect(await pressed(page)).toEqual(["Tech"]);
      await expect(page.locator(".post-list .post-link")).toHaveText(["Shipping my first agent"]);
      await page.locator(".tag-filter button", { hasText: "Philosophy" }).click();
      await expect(page.locator(".post-list .post-link")).toHaveText(["On carving"]);
      await page.goBack();
      await expect(page).toHaveURL(/\?tag=tech$/);
      expect(await pressed(page)).toEqual(["Tech"]);
      await page.goBack();
      expect(await pressed(page)).toEqual(["All"]);
      await expect(page.locator(".post-list .post-link")).toHaveCount(2);
      await page.goForward();
      expect(await pressed(page)).toEqual(["Tech"]);
    });

    test("?tag= deep link filters on load; tag chips link to their filter", async ({ page }) => {
      await page.goto("/reflections.html?tag=philosophy");
      await expect(page.locator(".post-list .post-link")).toHaveText(["On carving"]);
      await expect(page.locator(".tag-chip").first()).toHaveAttribute("href", "reflections.html?tag=philosophy");
    });

    test("post page: title, meta, inline markdown, no HTML injection, rel=noopener", async ({ page }) => {
      const errs = watchErrors(page);
      await page.goto("/reflections.html?post=shipping-agents");
      await expect(page).toHaveTitle("Shipping my first agent · Reflections");
      await expect(page.locator("h1")).toHaveText("Shipping my first agent");
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "What broke first.");
      const body = page.locator(".post-body");
      await expect(body.locator("strong").first()).toHaveText("bold");
      await expect(body.locator("em").first()).toHaveText("italic");

      const ext = body.getByRole("link", { name: "external link" });
      await expect(ext).toHaveAttribute("href", "https://example.com/x");
      await expect(ext).toHaveAttribute("target", "_blank");
      await expect(ext).toHaveAttribute("rel", /noopener/);
      const int = body.getByRole("link", { name: "internal link" });
      await expect(int).toHaveAttribute("href", "about.html");
      expect(await int.getAttribute("target")).toBeNull();
      await expect(page.locator(".reading-card a")).toHaveAttribute("rel", /noopener/);

      // Escaping: raw tags show as text, nothing executes, javascript: is not linked.
      await expect(body).toContainText('<img src=x onerror="window.__xss=1">');
      await expect(body).toContainText("<script>window.__xss=2</script>");
      expect(await body.locator("img, script, b").count(), "no injected elements").toBe(0);
      await expect(body.locator('a[href^="javascript:" i]')).toHaveCount(0);
      expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
      await expect(body.locator("li").nth(1)).toHaveText("Second <b>point</b>");
      await expect(body.locator("h2")).toHaveText("A subheading");
      await expect(body.locator("figure.post-quote figcaption")).toHaveText("Someone wise");

      for (const a of await page.locator('main a[target="_blank"]').all())
        expect(await a.getAttribute("rel"), `${await a.getAttribute("href")} has rel=noopener`).toMatch(/noopener/);
      expectNoErrors(errs, "reflections post");
    });
  });
});

test.describe("coffee page", () => {
  /** Count frames drawn on the visible coffee canvas (js/coffee.js draws the base layer once per frame). */
  const countDraws = (page) =>
    page.addInitScript(() => {
      const w = /** @type {any} */ (window);
      w.__coffeeDraws = 0;
      const orig = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args) {
        const c = this.canvas;
        if (c && c.parentElement && c.parentElement.classList.contains("coffee-scene")) w.__coffeeDraws++;
        return orig.apply(this, /** @type {any} */ (args));
      };
    });
  const draws = (page) => page.evaluate(() => /** @type {any} */ (window).__coffeeDraws);
  /** Draws during `ms` of real time, measured in-page so it holds under parallel load. */
  const drawsDuring = (page, ms) =>
    page.evaluate(async (t) => {
      const w = /** @type {any} */ (window);
      const a = w.__coffeeDraws;
      await new Promise((r) => setTimeout(r, t));
      return w.__coffeeDraws - a;
    }, ms);
  /** Bright, mostly opaque (steam/heart white) pixels in the inner heart rows, in canvas pixels. */
  const heartPixels = (page) =>
    page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.querySelector(".coffee-scene canvas"));
      const d = c.getContext("2d").getImageData(45, 15, 5, 4).data; // HEART rows 1-4, columns 1-5
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] > 200 && d[i + 2] > 190 && d[i + 3] > 170) n++;
      return n;
    });
  const intersects = (a, b) => !!(a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height);

  test("calendar link is primary, email visible, no form", async ({ page }) => {
    await page.goto("/contact.html");
    await expect(page.locator("main h1")).toHaveText(/^Let.s Get Coffee$/);
    const cal = page.locator(`main a[href="${CALENDAR_URL}"]`).first();
    await expect(cal).toBeVisible();
    const firstLink = await page.locator("main a[href]").first().getAttribute("href");
    expect(firstLink, "calendar is the first (primary) link in main").toBe(CALENDAR_URL);
    await expect(page.locator("main")).toContainText(/[\w.+-]+@[\w-]+\.[\w.]+/);
    await expect(page.locator("form")).toHaveCount(0);
  });

  test("sunset garden backdrop and a centred stone card", async ({ page }) => {
    await page.goto("/contact.html");
    await page.waitForLoadState("networkidle");
    const bg = await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage);
    expect(bg, "garden backdrop on body::before").toMatch(/garden-(mobile|desktop)\.webp/);
    const card = page.locator("#contact");
    await expect(card).toHaveClass(/\bstone\b/);
    const box = await card.boundingBox();
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    expect(box).not.toBeNull();
    if (box) expect(Math.abs(box.x + box.width / 2 - vw / 2), "card is horizontally centred").toBeLessThanOrEqual(2);
    expect(await card.evaluate((el) => getComputedStyle(el).textAlign)).toBe("center");
  });

  test("canvas scene: role=img with a label, fixed 96:44 aspect ratio, scene never resizes, page CLS < 0.1", async ({ page }) => {
    await page.addInitScript(() => {
      const w = /** @type {any} */ (window);
      w.__cls = 0;
      w.__sceneResized = [];
      new PerformanceObserver((l) => {
        for (const e of /** @type {any[]} */ (l.getEntries())) {
          if (e.hadRecentInput) continue;
          w.__cls += e.value;
          // A shift whose source is the scene itself with a changed size = the canvas caused it.
          for (const src of e.sources || []) {
            const el = src.node && src.node.nodeType === 1 ? src.node : null;
            if (!el || !el.closest(".coffee-scene")) continue;
            const a = src.previousRect, b = src.currentRect;
            if (Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1) w.__sceneResized.push(`${a.width}x${a.height} -> ${b.width}x${b.height}`);
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/contact.html");
    const canvas = page.locator(".coffee-scene canvas");
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute("role", "img");
    await expect(canvas).toHaveAttribute("aria-label", /^(?=.*\bcoffee\b).{20,}$/i);
    const before = await page.locator(".coffee-scene").boundingBox();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const after = await page.locator(".coffee-scene").boundingBox();
    expect(after).not.toBeNull();
    if (before && after) {
      expect(Math.abs(after.height - before.height), "scene height is fixed from first layout").toBeLessThanOrEqual(1);
      expect(Math.abs(after.width / after.height - 96 / 44), `aspect ratio ${after.width}x${after.height}`).toBeLessThan(0.02);
    }
    expect(await page.locator(".coffee-scene").evaluate((el) => getComputedStyle(el).aspectRatio.replace(/\s/g, ""))).toBe("96/44");
    const { cls, resized } = await page.evaluate(() => ({ cls: /** @type {any} */ (window).__cls, resized: /** @type {any} */ (window).__sceneResized }));
    expect(resized, "layout shifts where the coffee scene changed size").toEqual([]);
    // Page-level CLS (Definition of Done: < 0.1). The card above the scene re-renders and the
    // web fonts swap, which moves the scene without resizing it; see the QA report.
    expect(cls, "cumulative layout shift on the coffee page").toBeLessThan(0.1);
    test.info().annotations.push({ type: "cls", description: `contact.html CLS ${cls.toFixed(4)}` });
  });

  test("animation starts only when visible and pauses off-screen and in a hidden tab", async ({ page }) => {
    const vw = (page.viewportSize() || { width: 375 }).width;
    await page.setViewportSize({ width: vw, height: 220 }); // short viewport: the scene starts below the fold
    await countDraws(page);
    const errs = watchErrors(page);
    await page.goto("/contact.html");
    await page.waitForLoadState("networkidle");
    const top = await page.locator(".coffee-scene").evaluate((el) => el.getBoundingClientRect().top);
    expect(top, "precondition: scene is below the fold").toBeGreaterThan(220);
    expect(await drawsDuring(page, 500), "no frames drawn while off-screen").toBe(0);

    await page.locator(".coffee-scene").scrollIntoViewIfNeeded();
    await expect.poll(() => draws(page), { message: "starts drawing once visible" }).toBeGreaterThan(0);
    expect(await drawsDuring(page, 700), "keeps animating while visible").toBeGreaterThan(1);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250); // let the IntersectionObserver report
    expect(await drawsDuring(page, 600), "paused after scrolling away").toBe(0);

    await page.locator(".coffee-scene").scrollIntoViewIfNeeded();
    await expect.poll(() => drawsDuring(page, 300), { message: "resumes when visible again" }).toBeGreaterThan(0);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { get: () => true, configurable: true });
      Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    expect(await drawsDuring(page, 600), "paused while the tab is hidden").toBe(0);
    expectNoErrors(errs, "coffee animation");
  });

  test("Easter eggs: two focusable invisible buttons; statue says an announced 'So I did.'", async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto("/contact.html");
    const eggs = page.locator(".coffee-scene button.coffee-egg");
    await expect(eggs).toHaveCount(2);
    for (const b of await eggs.all()) {
      await expect(b).toHaveAttribute("type", "button");
      await expect(b).toHaveAttribute("aria-label", /\S/);
      expect(await b.evaluate((el) => el.tabIndex), "egg is in the Tab order").toBe(0);
      const look = await b.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, border: cs.borderTopWidth, text: (el.textContent || "").trim() };
      });
      expect(look, "egg is invisible (no fill, border or text)").toEqual({ bg: "rgba(0, 0, 0, 0)", border: "0px", text: "" });
    }
    const bubble = page.locator(".coffee-bubble");
    await expect(bubble, "live region exists before it speaks").toHaveAttribute("aria-live", /polite|assertive/);
    await expect(bubble).toHaveText("");
    await page.getByRole("button", { name: /statue/i }).click();
    await expect(bubble).toHaveText("So I did.");
    await expect(bubble).toBeVisible();
    // Keyboard works too: focus the steam egg and press Enter, with a visible focus ring.
    const steam = page.getByRole("button", { name: /steam/i });
    await steam.focus();
    await page.keyboard.press("Enter");
    const ring = await steam.evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    });
    expect(ring, "visible focus ring on the steam egg").toBe(true);
    expectNoErrors(errs, "coffee eggs");
  });

  test("three steam taps make a heart (reduced motion: still frame, no loop)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await countDraws(page);
    const errs = watchErrors(page);
    await page.goto("/contact.html");
    await expect.poll(() => draws(page), { message: "still frame drawn" }).toBeGreaterThan(0);
    expect(await drawsDuring(page, 700), "no animation loop under reduced motion").toBe(0);
    const blank = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.querySelector(".coffee-scene canvas"));
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });
    expect(blank, "still frame is painted").toBeGreaterThan(500);

    const steam = page.getByRole("button", { name: /steam/i });
    expect(await heartPixels(page), "no heart before tapping").toBeLessThanOrEqual(4);
    await steam.click();
    await steam.click();
    expect(await heartPixels(page), "no heart after two taps").toBeLessThanOrEqual(4);
    await steam.click();
    await expect.poll(() => heartPixels(page), { message: "heart after the third tap" }).toBeGreaterThanOrEqual(12);
    expectNoErrors(errs, "coffee heart");
  });

  test("Easter egg buttons never overlap the booking button", async ({ page }) => {
    await page.goto("/contact.html");
    await page.waitForLoadState("networkidle");
    const book = page.locator(`main a[href="${CALENDAR_URL}"]`).first();
    const bb = await book.boundingBox();
    expect(bb).not.toBeNull();
    for (const egg of await page.locator(".coffee-egg").all()) {
      const eb = await egg.boundingBox();
      expect(intersects(bb, eb), `${await egg.getAttribute("aria-label")} overlaps Book a coffee chat (${JSON.stringify(eb)} vs ${JSON.stringify(bb)})`).toBe(false);
    }
    // And the booking button is what receives a tap at its centre.
    const hit = await book.evaluate((a) => {
      const r = a.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!el && (el === a || a.contains(el));
    });
    expect(hit, "booking button is on top at its centre").toBe(true);
  });
});

test.describe("journey 3: keyboard only", () => {
  test.skip(({ browserName }) => browserName === "webkit", "WebKit does not tab to links by default");

  /** Press Tab up to `max` times, returning a descriptor of each focused element. */
  async function tabWalk(page, max = 40, key = "Tab") {
    const seen = [];
    for (let i = 0; i < max; i++) {
      await page.keyboard.press(key);
      const d = await page.evaluate(() => {
        const a = /** @type {HTMLElement} */ (document.activeElement);
        if (!a || a === document.body) return null;
        const cs = getComputedStyle(a);
        const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
        return {
          name: (a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim().replace(/[‘’]/g, "'"),
          id: a.id,
          href: a.getAttribute("href") || "",
          ring: !!ring,
          hidden: !!a.closest("[inert],[aria-hidden='true']"),
        };
      });
      if (!d) break;
      seen.push(d);
    }
    return seen;
  }

  test("home: skip link -> nav -> both buttons, visible focus, nothing hidden focused", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("blockquote")).toBeVisible();
    const seen = await tabWalk(page, 25);
    const names = seen.map((s) => s.name);
    for (const label of NAV_ORDER) expect(names, `Tab reaches nav "${label}"`).toContain(label);
    expect(names.some((n) => /scroll to reveal/i.test(n)), "Tab reaches Scroll to reveal").toBe(true);
    expect(names.some((n) => /skip to resume/i.test(n)), "Tab reaches Skip to Resume").toBe(true);
    expect(seen.filter((s) => !s.ring).map((s) => s.name), "focused elements without a visible focus indicator").toEqual([]);
    expect(seen.filter((s) => s.hidden).map((s) => s.name), "focus landed inside inert/aria-hidden content").toEqual([]);
  });

  test("Enter on Scroll to reveal, then Skip to Resume -> resume -> coffee -> calendar link", async ({ page }) => {
    await page.goto("/index.html");
    await page.locator(SEL.scrollHint).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await page.goto("/index.html");
    await page.getByRole("link", { name: /skip to resume/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/resume\.html#document$/);

    // Focus starts on the resume heading (below the header), so walk backwards to the nav.
    const seen = await tabWalk(page, 30, "Shift+Tab");
    for (const label of NAV_ORDER) expect(seen.map((s) => s.name), `Tab reaches "${label}" on resume`).toContain(label);
    await page.locator(SEL.nav).first().getByRole("link", { name: /Let.s Get Coffee/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/contact\.html/);
    const onContact = await tabWalk(page, 20);
    expect(onContact.some((s) => s.href === CALENDAR_URL), "calendar link reachable by keyboard").toBe(true);
  });
});
