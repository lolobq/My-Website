// @ts-check
/*
 * Resume (the PDF; highlight slabs on phones), Projects (one-screen queue of stone tiles + dialogs,
 * journey 6), Reflections (tags, filter,
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
    await expect(page.locator(".resume-slabs"), "no highlight slabs next to the PDF frame").toBeHidden();
    await expect(page.locator(SEL.resumeText), "text version exposed to screen readers with the frame").not.toHaveAttribute("aria-hidden", /.*/);

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
    await expect(page.locator(".resume-slabs"), "slabs come back with the slab layout").toBeVisible();
    await expect(page.locator(SEL.resumeText)).toHaveAttribute("aria-hidden", "true");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(frame, "frame returns when widened again").toHaveCount(1);
    await expect(page.locator(SEL.resumeText)).not.toHaveAttribute("aria-hidden", /.*/);
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

  test.describe("phone highlight slabs", () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes("mobile"), "mobile-only");
    });

    /** Text actually painted on screen: text nodes outside .sr-only / noscript with a real box. */
    const visibleText = (page) =>
      page.evaluate(() => {
        const out = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!/\S/.test(n.textContent || "")) continue;
          const el = n.parentElement;
          if (!el || el.closest(".sr-only, noscript, script, style, [hidden]")) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none") continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const r = range.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          out.push(n.textContent);
        }
        return out.join(" ").replace(/\s+/g, " ");
      });

    test("Open/Download slab on top, then Experience, Skills, Publications, Education slabs in order", async ({ page }) => {
      await forcePdfViewer(page); // phones get the slabs even when a viewer exists
      const errs = watchErrors(page);
      await page.goto("/resume.html");
      const R = await page.evaluate(() => /** @type {any} */ (window).RESUME);
      const fallback = page.locator(SEL.resumeFallback);
      await expect(fallback).toBeVisible();
      expect(await fallback.locator("a").count(), "two links in the top slab").toBe(2);

      const slabs = page.locator("#document .resume-slabs");
      await expect(slabs).toBeVisible();
      const kickers = slabs.locator(".resume-group > h2.resume-kicker");
      expect((await kickers.allInnerTexts()).map(norm).map((s) => s.toLowerCase())).toEqual(["experience", "skills", "publications", "education"]);
      for (const k of await kickers.all()) await expect(k).toHaveClass(/\bstone\b/);

      // Vertical order on screen: the button slab, then each group below the one before.
      const tops = await page.evaluate(() => [
        document.querySelector("#document .resume-fallback").getBoundingClientRect().bottom,
        ...[...document.querySelectorAll("#document .resume-group")].map((g) => g.getBoundingClientRect().top),
      ]);
      for (let i = 1; i < tops.length; i++) expect(tops[i], `slab ${i} sits below the one before (${tops.join(", ")})`).toBeGreaterThan(tops[i - 1]);

      // One stone slab per role and per school, one each for skills and publications.
      const groups = slabs.locator(".resume-group");
      await expect(groups.nth(0).locator(".resume-slab.stone")).toHaveCount(R.experience.length);
      await expect(groups.nth(1).locator(".resume-slab.stone")).toHaveCount(1);
      await expect(groups.nth(2).locator(".resume-slab.stone")).toHaveCount(1);
      await expect(groups.nth(3).locator(".resume-slab.stone")).toHaveCount(R.education.length);
      for (const [i, e] of R.experience.entries()) await expect(groups.nth(0).locator(".resume-slab h3").nth(i)).toContainText(e.org);
      for (const [i, e] of R.education.entries()) await expect(groups.nth(3).locator(".resume-slab h3").nth(i)).toContainText(e.school);
      for (const p of R.publications) await expect(groups.nth(2)).toContainText(p.citation);

      // The page may scroll here, but never sideways.
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sw, "no horizontal scroll with the slabs").toBeLessThanOrEqual(1);
      expectNoErrors(errs, "resume slabs");
    });

    test("no summary, no honors, no disc golf text anywhere on screen", async ({ page }) => {
      await page.goto("/resume.html");
      await expect(page.locator("#document .resume-slabs")).toBeVisible();
      const R = await page.evaluate(() => /** @type {any} */ (window).RESUME);
      expect(R.honors.length, "precondition: content has honors to keep off screen").toBeGreaterThan(0);
      const text = norm(await visibleText(page));
      expect(text, "slab text is on screen (sanity)").toContain(R.experience[0].org);
      expect(text, "disc golf on screen").not.toMatch(/disc\s*golf/i);
      for (const h of R.honors) expect(text, `honor "${h}" on screen`).not.toContain(norm(h));
      if (R.summary) expect(text, "summary on screen").not.toContain(norm(R.summary).slice(0, 60));
      expect(text, "Honors / Summary headings on screen").not.toMatch(/\b(honors|summary)\b/i);
      await expect(page.locator("#document .resume-slabs").getByText(/disc\s*golf/i)).toHaveCount(0);
    });

    test("sr-only text version is aria-hidden while the slabs show; exposed in print", async ({ page }) => {
      await page.goto("/resume.html");
      const text = page.locator(SEL.resumeText);
      await expect(text).toHaveAttribute("aria-hidden", "true");
      // The slabs are what screen readers get: real headings, labelled groups.
      await expect(page.getByRole("heading", { name: /^experience$/i })).toHaveCount(1);
      await page.emulateMedia({ media: "print" });
      await expect(text).not.toHaveAttribute("aria-hidden", /.*/);
      await expect(page.locator(".resume-slabs")).toBeHidden();
      await page.emulateMedia({ media: "screen" });
      await expect(text, "hidden again after printing").toHaveAttribute("aria-hidden", "true");
    });
  });

  test("text version: sr-only <article>, 500+ chars, links out of the Tab order", async ({ page }) => {
    await page.goto("/resume.html");
    const text = page.locator(SEL.resumeText);
    await expect(text).toHaveCount(1);
    expect(await text.evaluate((el) => el.tagName)).toBe("ARTICLE");
    await expect(text).toHaveClass(/\bsr-only\b/);
    expect(await srOnly(text), "visually hidden").toBe(true);
    expect(norm(await text.textContent()).length, "real HTML resume text").toBeGreaterThan(500);
    // CSS, not role: while the phone slabs show, the text version is aria-hidden (no ARIA headings).
    await expect(text.locator("h2", { hasText: /^experience$/i })).toHaveCount(1);
    const links = await text.locator("a").evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href"), ti: a.getAttribute("tabindex") })));
    expect(links.filter((l) => l.ti !== "-1"), "text-version links reachable by Tab (focus would go invisible)").toEqual([]);
    // Exactly one of the two is exposed to screen readers: the slabs (text version aria-hidden)
    // or, with no slabs on screen, the text version. Headless Chromium has no PDF viewer, so the
    // slabs show in both projects here.
    const slabsShown = await painted(page.locator(".resume-slabs"));
    expect(slabsShown, "headless (no viewer): slabs on screen").toBe(true);
    await expect(text).toHaveAttribute("aria-hidden", "true");
  });

  test("print shows the text version and hides the PDF region", async ({ page }) => {
    await page.goto("/resume.html");
    await expect(page.locator(SEL.resumeText), "precondition: aria-hidden while the slabs show").toHaveAttribute("aria-hidden", "true");
    await page.emulateMedia({ media: "print" });
    const text = page.locator(SEL.resumeText);
    await expect(text, "exposed again for print").not.toHaveAttribute("aria-hidden", /.*/);
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

  /** Move the queue to tile i with the Next button (only the centred tile is clickable). */
  const moveTo = async (page, i) => {
    for (let k = 0; k < i; k++) await page.getByRole("button", { name: "Next project" }).click();
    await expect(page.locator(".tiles > li.tile").nth(i)).toHaveClass(/\bis-current\b/);
  };

  test("tile opens a modal dialog; focus moves in; Esc closes and focus returns", async ({ page }) => {
    await page.goto("/projects.html");
    await moveTo(page, 1);
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

  test("#hash deep link opens its panel on load and moves the queue to its tile", async ({ page }) => {
    await page.goto("/projects.html#stealth-ai-startup");
    const dlg = page.locator("dialog#stealth-ai-startup");
    await expect(dlg).toHaveAttribute("open", "");
    await expect(page.locator(".tiles")).not.toHaveClass(/is-entering/);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    const tile = page.locator(".tiles > li.tile").nth(2);
    await expect(tile).toHaveClass(/\bis-current\b/);
    await expect(page.locator(".tiles")).toHaveAttribute("style", /--at:\s*2/);
    await expect(page.locator(".queue-dot").nth(2)).toHaveAttribute("aria-current", "true");
    await expect(page.locator(".queue-status"), "deep links move the queue quietly").toHaveText("");
    // Closing returns focus to that tile's link, which is the live (non-inert) one.
    await page.keyboard.press("Escape");
    await expect(dlg).not.toHaveAttribute("open", "");
    await expect(tile.locator("a.tile-link")).toBeFocused();
    expect(await tile.evaluate((el) => el.hasAttribute("inert"))).toBe(false);
    // A later hash change moves it again.
    await page.evaluate(() => { location.hash = "#capstone"; });
    await expect(page.locator("dialog#capstone")).toHaveAttribute("open", "");
    await expect(page.locator(".tiles > li.tile").nth(1)).toHaveClass(/\bis-current\b/);
  });

  test("back closes a panel opened from a tile; forward reopens it", async ({ page }) => {
    await page.goto("/projects.html");
    await moveTo(page, 1);
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

  test.describe("one-screen queue", () => {
    const TILE_ART = Object.fromEntries(TILE_KEYS.map((k) => [k, `assets/img/projects/${k}.svg`]));

    /** Queue state read straight from the DOM. */
    const state = (page) =>
      page.evaluate(() => {
        const ts = [...document.querySelectorAll(".tiles > li.tile")];
        const attr = (sel, a) => { const el = document.querySelector(sel); return el && el.getAttribute(a); };
        return {
          at: ts.findIndex((t) => t.classList.contains("is-current")),
          currents: ts.filter((t) => t.classList.contains("is-current")).length,
          inert: ts.map((t) => t.hasAttribute("inert")),
          cssAt: document.querySelector(".tiles").style.getPropertyValue("--at").trim(),
          dots: [...document.querySelectorAll(".queue-dot")].map((d) => d.getAttribute("aria-current")),
          dotLabels: [...document.querySelectorAll(".queue-dot")].map((d) => d.getAttribute("aria-label")),
          prev: attr('.queue-arrow[data-step="-1"]', "aria-disabled"),
          next: attr('.queue-arrow[data-step="1"]', "aria-disabled"),
          count: (document.querySelector(".queue-count") || {}).textContent,
          status: document.querySelector(".queue-status").textContent,
          scrollY: window.scrollY,
        };
      });
    /** Assert the queue sits at tile i, with every control in step; `announced` = the live region spoke. */
    const expectAt = async (page, i, { announced = true } = {}) => {
      await expect.poll(async () => (await state(page)).at, { message: `queue at tile ${i}` }).toBe(i);
      const s = await state(page);
      const n = TILE_KEYS.length;
      expect(s.currents, "exactly one centred tile").toBe(1);
      expect(s.inert, "every tile but the centred one is inert").toEqual(TILE_KEYS.map((_, k) => k !== i));
      expect(s.cssAt, "--at drives the slide").toBe(String(i));
      expect(s.dots, "aria-current on the matching dot only").toEqual(TILE_KEYS.map((_, k) => (k === i ? "true" : null)));
      expect(s.prev, "Previous is aria-disabled only at the start").toBe(i === 0 ? "true" : null);
      expect(s.next, "Next is aria-disabled only at the end").toBe(i === n - 1 ? "true" : null);
      expect(s.count).toBe(`${i + 1} of ${n}`);
      if (announced) expect(s.status, "live region announces the change").toBe(s.dotLabels[i]);
      expect(s.scrollY, "the page itself never scrolls").toBe(0);
    };
    /** One wheel gesture (a burst of events, like a trackpad flick and its momentum), dispatched in-page. */
    const wheelGesture = (page, { dx = 0, dy = 0, events = 10 }) =>
      page.evaluate(
        ({ dx, dy, events }) => {
          for (let k = 0; k < events; k++) window.dispatchEvent(new WheelEvent("wheel", { deltaX: dx, deltaY: dy, deltaMode: 0, bubbles: true, cancelable: true }));
        },
        { dx, dy, events }
      );
    const quiet = (page) => page.waitForTimeout(320); // the gesture lock releases after 200ms of quiet

    test("no vertical (or sideways) scroll: the page is exactly one viewport", async ({ page }, testInfo) => {
      const sizes = testInfo.project.name.includes("mobile")
        ? [{ width: 360, height: 640 }, { width: 375, height: 812 }]
        : [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];
      for (const vp of sizes) {
        await page.setViewportSize(vp);
        await page.goto("/projects.html");
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState("networkidle");
        const m = await page.evaluate(() => {
          const de = document.documentElement;
          const box = (sel) => { const el = document.querySelector(sel); const r = el && el.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null; };
          return {
            sh: de.scrollHeight, ih: window.innerHeight, sw: de.scrollWidth, iw: window.innerWidth,
            controls: box(".queue-controls"), also: box(".also"), title: box(".tile.is-current .tile-title"), tile: box(".tile.is-current"),
          };
        });
        const tag = `${vp.width}x${vp.height}`;
        expect(m.sh, `${tag}: scrollHeight ${m.sh} equals the viewport height ${m.ih}`).toBeLessThanOrEqual(m.ih);
        expect(m.sw, `${tag}: no sideways scroll`).toBeLessThanOrEqual(m.iw);
        expect(m.controls && m.controls.bottom, `${tag}: prev/next and dots on screen`).toBeLessThanOrEqual(m.ih);
        if (m.also) expect(m.also.bottom, `${tag}: Also exploring on screen`).toBeLessThanOrEqual(m.ih);
        expect(m.title && m.tile && m.title.bottom <= m.tile.bottom && m.title.top >= m.tile.top, `${tag}: tile title inside its tile`).toBe(true);
      }
    });

    test("one centred tile; neighbours peek, are inert and unfocusable", async ({ page }) => {
      await page.goto("/projects.html");
      await expectAt(page, 0, { announced: false });
      await expect(page.locator(".queue-status"), "silent on load").toHaveText("");
      await expect(page.locator(".queue")).toHaveAttribute("aria-roledescription", "carousel");
      await expect(page.locator(".queue")).toHaveAttribute("aria-label", /\S/);
      await expect(page.locator(".queue-status")).toHaveAttribute("aria-live", "polite");
      // Every position is centred once the slide settles (the transition is 420ms).
      const offCentre = () =>
        page.evaluate(() => {
          const r = document.querySelector(".tile.is-current").getBoundingClientRect();
          return Math.round(Math.abs(r.left + r.width / 2 - document.documentElement.clientWidth / 2));
        });
      for (const i of [1, 2, 3, 0, 1]) {
        await page.locator(".queue-dot").nth(i).click();
        await expectAt(page, i);
        await expect.poll(offCentre, { message: `tile ${i + 1} of 4 centred (px off centre)` }).toBeLessThanOrEqual(2);
      }
      // Both neighbours peek inside the viewport, smaller and dimmed.
      const peek = await page.evaluate(() => {
        const ts = [...document.querySelectorAll(".tiles > li.tile")];
        const vw = document.documentElement.clientWidth;
        return [0, 2].map((k) => {
          const r = ts[k].getBoundingClientRect();
          const cs = getComputedStyle(ts[k]);
          return { visible: Math.min(r.right, vw) - Math.max(r.left, 0), opacity: +cs.opacity };
        });
      });
      for (const p of peek) {
        expect(p.visible, "neighbour peeks into the viewport").toBeGreaterThan(4);
        expect(p.opacity, "neighbour is dimmed").toBeLessThan(1);
      }
      // Inert neighbours cannot take focus.
      const focusable = await page.evaluate(() =>
        [...document.querySelectorAll(".tiles > li.tile:not(.is-current) a")].filter((a) => { a.focus(); return document.activeElement === a; }).length
      );
      expect(focusable, "links in inert neighbours took focus").toBe(0);
    });

    test("wheel: one gesture moves one tile; down/right = next, up/left = previous", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/projects.html");
      await page.mouse.move(200, 300);
      await page.mouse.wheel(0, 120); // a real wheel notch, down
      await expectAt(page, 1);
      await quiet(page);
      await wheelGesture(page, { dy: 30, events: 12 }); // one long flick: 360px of travel
      await expectAt(page, 2);
      await quiet(page);
      await wheelGesture(page, { dx: 60, events: 6 }); // trackpad sideways, right
      await expectAt(page, 3);
      await quiet(page);
      await wheelGesture(page, { dy: 60, events: 6 }); // past the end: stays
      await expectAt(page, 3);
      await quiet(page);
      await wheelGesture(page, { dy: -50, events: 8 });
      await expectAt(page, 2);
      await quiet(page);
      await page.mouse.wheel(-120, 0); // sideways, left
      await expectAt(page, 1);
      await quiet(page);
      await wheelGesture(page, { dy: 10, events: 3 }); // under the 40px threshold: no move
      await quiet(page);
      await expectAt(page, 1);
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    });

    test("wheel does nothing while a dialog is open", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/projects.html");
      await tileLinks(page).first().click();
      await expect(page.locator("dialog#smartcity")).toHaveAttribute("open", "");
      await wheelGesture(page, { dy: 80, events: 4 });
      await page.keyboard.press("Escape");
      await expectAt(page, 0, { announced: false });
    });

    test("keys: ArrowLeft/Right, PageUp/PageDown, Home/End; focus follows the centred tile", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/projects.html");
      await page.locator(".tile.is-current a.tile-link").focus();
      const focusedTile = () => page.evaluate(() => [...document.querySelectorAll(".tiles > li.tile")].findIndex((t) => t.contains(document.activeElement)));
      const steps = [["ArrowRight", 1], ["PageDown", 2], ["End", 3], ["ArrowRight", 3], ["PageUp", 2], ["ArrowLeft", 1], ["Home", 0], ["ArrowLeft", 0]];
      for (const [key, want] of steps) {
        await page.keyboard.press(String(key));
        await expectAt(page, Number(want));
        expect(await focusedTile(), `${key}: focus on the centred tile's link`).toBe(want);
      }
      // Keys also work from the controls, and every move is announced.
      await page.locator(".queue-dot").nth(0).focus();
      await page.keyboard.press("End");
      await expectAt(page, 3);
      await expect(page.locator("dialog[open]"), "no key opened a dialog").toHaveCount(0);
    });

    test("swipe: left = next, right = previous, vertical swipes too; short drags do nothing", async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.includes("mobile"), "touch: mobile project only");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/projects.html");
      const cdp = await page.context().newCDPSession(page);
      const box = await page.locator(".queue-viewport").boundingBox();
      if (!box) throw new Error("no queue viewport");
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const swipe = async (dx, dy) => {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
        for (let k = 1; k <= 5; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + (dx * k) / 5, y: cy + (dy * k) / 5 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      };
      await swipe(-120, 0);
      await expectAt(page, 1);
      await swipe(-120, 10);
      await expectAt(page, 2);
      await swipe(120, 0);
      await expectAt(page, 1);
      await swipe(0, -120); // swipe up = next (the page does not scroll)
      await expectAt(page, 2);
      await swipe(20, 0); // too short
      await expectAt(page, 2);
      await expect(page.locator("dialog[open]"), "a swipe is not a tap").toHaveCount(0);
    });

    test("prev/next buttons, aria-disabled at the ends; dots with aria-current", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/projects.html");
      const prev = page.getByRole("button", { name: "Previous project" });
      const next = page.getByRole("button", { name: "Next project" });
      await expect(prev).toHaveAttribute("aria-disabled", "true");
      await prev.click({ force: true }); // aria-disabled: Playwright would wait; a user can still click it, and nothing happens
      await expectAt(page, 0, { announced: false });
      for (let i = 1; i < TILE_KEYS.length; i++) {
        await next.click();
        await expectAt(page, i);
      }
      await expect(next).toHaveAttribute("aria-disabled", "true");
      await next.click({ force: true });
      await expectAt(page, TILE_KEYS.length - 1);
      await prev.click();
      await expectAt(page, TILE_KEYS.length - 2);
      const dots = page.locator(".queue-dot");
      await expect(dots).toHaveCount(TILE_KEYS.length);
      for (const i of [0, 3, 1]) {
        await dots.nth(i).click();
        await expectAt(page, i);
      }
      const labels = await dots.evaluateAll((ds) => ds.map((d) => d.getAttribute("aria-label")));
      labels.forEach((l, i) => expect(l).toMatch(new RegExp(`^Project ${i + 1} of ${TILE_KEYS.length}: \\S`)));
      await expect(page.locator(".queue-count"), "the visual 2 of 4 is not read twice").toHaveAttribute("aria-hidden", "true");
    });

    test("clicking a peeking neighbour centres it (and opens nothing)", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/projects.html");
      const peekPoint = (k) =>
        page.evaluate((k) => {
          const t = document.querySelectorAll(".tiles > li.tile")[k];
          const r = t.getBoundingClientRect();
          const vp = document.querySelector(".queue-viewport").getBoundingClientRect();
          const x0 = Math.max(r.left, vp.left, 0), x1 = Math.min(r.right, vp.right, document.documentElement.clientWidth);
          return { x: (x0 + x1) / 2, y: r.top + r.height / 2, w: x1 - x0 };
        }, k);
      let p = await peekPoint(1);
      expect(p.w, "right neighbour visible").toBeGreaterThan(4);
      await page.mouse.click(p.x, p.y);
      await expectAt(page, 1);
      p = await peekPoint(2);
      await page.mouse.click(p.x, p.y);
      await expectAt(page, 2);
      p = await peekPoint(1);
      expect(p.w, "left neighbour visible").toBeGreaterThan(4);
      await page.mouse.click(p.x, p.y);
      await expectAt(page, 1);
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    });

    test("each tile shows its TILE_ART image; the stealth tile's is a local, generic SVG", async ({ page, request }) => {
      const errs = watchErrors(page);
      await page.goto("/projects.html");
      await page.waitForLoadState("networkidle");
      const imgs = await page.$$eval(".tiles > li.tile", (ts) =>
        ts.map((t) => {
          const im = t.querySelector(".tile-art img");
          return im && { src: im.getAttribute("src"), alt: im.getAttribute("alt"), w: im.getAttribute("width"), h: im.getAttribute("height"), ok: im.complete && im.naturalWidth > 0, key: t.querySelector("a.tile-link").dataset.panel };
        })
      );
      expect(imgs.map((i) => i && i.key)).toEqual(TILE_KEYS);
      for (const im of imgs) {
        expect(im, "tile has an image").not.toBeNull();
        if (!im) continue;
        expect(im.src, `${im.key}: src from TILE_ART`).toBe(TILE_ART[im.key]);
        expect(im.alt, `${im.key}: decorative (the title says it)`).toBe("");
        expect([im.w, im.h], `${im.key}: width/height reserve the box`).toEqual(["160", "120"]);
        expect(im.ok, `${im.key}: image loaded`).toBe(true);
      }
      const stealth = imgs.find((i) => i && i.key === "stealth-ai-startup");
      const src = (stealth && stealth.src) || "";
      expect(src, "stealth art is local").not.toMatch(/^(https?:)?\/\//i);
      expect(src).toMatch(/\.svg$/);
      const res = await request.get(`/${src}`);
      expect(res.status()).toBe(200);
      const svg = await res.text();
      expect(svg.trim(), "an SVG document").toMatch(/^<svg[\s>]/);
      expect(svg.length, "small pixel-art icon").toBeLessThan(10_000);
      expect(svg, "no text (a name or logotype) in the stealth art").not.toMatch(/<text\b/i);
      expect(svg, "no embedded or linked raster (screenshot, logo)").not.toMatch(/<image\b|data:image\/|xlink:href|href\s*=\s*["']https?:/i);
      expect(svg, "no external references").not.toMatch(/url\(\s*["']?https?:/i);
      expectNoErrors(errs, "projects tile art");
    });
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
    // Force an empty list so this does not depend on the posts content.js ships.
    await injectPosts(page, []);
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
    // Force an empty list so this does not depend on the posts content.js ships.
    await injectPosts(page, []);
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

  test("canvas scene: role=img with a label, 96x44 canvas in a fixed-ratio box, scene never resizes, page CLS < 0.1", async ({ page }) => {
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
      // The box keeps its declared ratio (96 wide; its height crops the empty rows above the heads).
      const ar = await page.locator(".coffee-scene").evaluate((el) => getComputedStyle(el).aspectRatio.replace(/\s/g, ""));
      const m = ar.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
      expect(m, `declared aspect-ratio "${ar}"`).not.toBeNull();
      if (m) expect(Math.abs(after.width / after.height - +m[1] / +m[2]), `box ${after.width}x${after.height} vs ${ar}`).toBeLessThan(0.02);
      expect(after.width / 96, "drawn at a whole pixel scale").toBeCloseTo(Math.round(after.width / 96), 2);
    }
    expect(await canvas.evaluate((c) => [c.width, c.height]), "logical canvas stays 96x44").toEqual([96, 44]);
    const { cls, resized } = await page.evaluate(() => ({ cls: /** @type {any} */ (window).__cls, resized: /** @type {any} */ (window).__sceneResized }));
    expect(resized, "layout shifts where the coffee scene changed size").toEqual([]);
    // Page-level CLS (Definition of Done: < 0.1). The card above the scene re-renders and the
    // web fonts swap, which moves the scene without resizing it; see the QA report.
    expect(cls, "cumulative layout shift on the coffee page").toBeLessThan(0.1);
    test.info().annotations.push({ type: "cls", description: `contact.html CLS ${cls.toFixed(4)}` });
  });

  /** Where the scene is and whether it is shown (the stage hides under 500px; coffee.js hides it below 3x). */
  const sceneState = (page) =>
    page.evaluate(() => {
      const stage = document.querySelector(".coffee-stage");
      const wrap = document.querySelector(".coffee-scene");
      const r = wrap && wrap.getBoundingClientRect();
      return {
        stageDisplay: stage ? getComputedStyle(stage).display : "missing",
        hidden: !wrap || wrap.hidden || !r || r.width === 0 || r.height === 0,
        scale: wrap ? wrap.style.getPropertyValue("--s") : "",
        w: r ? Math.round(r.width) : 0,
      };
    });
  const COFFEE_SIZES = {
    mobile: [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 768, height: 1024 }],
    desktop: [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }],
  };

  test("one screen: zero scroll at every size; Easter eggs never overlap a link", async ({ page }, testInfo) => {
    const errs = watchErrors(page);
    const sizes = COFFEE_SIZES[testInfo.project.name.includes("mobile") ? "mobile" : "desktop"];
    const notes = [];
    for (const vp of sizes) {
      await page.setViewportSize(vp);
      await page.goto("/contact.html");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      const tag = `${vp.width}x${vp.height}`;
      const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
      expect(m.sh, `${tag}: scrollHeight ${m.sh} > viewport ${m.ih}`).toBeLessThanOrEqual(m.ih);
      expect(m.sw, `${tag}: sideways scroll`).toBeLessThanOrEqual(m.iw);
      const s = await sceneState(page);
      notes.push(`${tag}: scene ${s.hidden ? "hidden" : `${s.scale}x (${s.w}px)`}`);
      expect(s.hidden, `${tag}: the scene is shown on screens 500px+ tall`).toBe(false);
      if (!s.hidden) {
        expect(Number(s.scale), `${tag}: whole pixel scale 3..6`).toBeGreaterThanOrEqual(3);
        expect(Number(s.scale)).toBeLessThanOrEqual(6);
        const sb = await page.locator(".coffee-scene").boundingBox();
        const cb = await page.locator("#contact").boundingBox();
        expect(sb && sb.y + sb.height, `${tag}: scene stands inside the viewport`).toBeLessThanOrEqual(m.ih + 1);
        const gap = sb && cb ? Math.round(sb.y - (cb.y + cb.height)) : NaN;
        expect(gap, `${tag}: gap between the card bottom and the scene top (the heads)`).toBeGreaterThanOrEqual(16);
        expect(gap, `${tag}: gap between the card bottom and the scene top (the heads)`).toBeLessThanOrEqual(28);
      }
      // No egg covers any link or button in the card, and each link is on top at its centre.
      const links = await page.locator("#contact a[href], #contact button").all();
      expect(links.length).toBeGreaterThan(0);
      const eggs = s.hidden ? [] : await page.locator(".coffee-egg").all();
      for (const l of links) {
        const lb = await l.boundingBox();
        for (const egg of eggs) {
          const eb = await egg.boundingBox();
          expect(intersects(lb, eb), `${tag}: ${await egg.getAttribute("aria-label")} overlaps "${norm(await l.textContent())}"`).toBe(false);
        }
        const onTop = await l.evaluate((a) => {
          const r = a.getBoundingClientRect();
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!el && (el === a || a.contains(el));
        });
        expect(onTop, `${tag}: "${norm(await l.textContent())}" is on top at its centre`).toBe(true);
      }
    }
    test.info().annotations.push({ type: "coffee scene", description: notes.join("; ") });
    expectNoErrors(errs, "coffee one screen");
  });

  test("short screens (< 500px tall): the scene steps aside", async ({ page }, testInfo) => {
    const sizes = testInfo.project.name.includes("mobile") ? [{ width: 375, height: 480 }, { width: 812, height: 375 }] : [{ width: 1366, height: 499 }];
    for (const vp of sizes) {
      await page.setViewportSize(vp);
      await page.goto("/contact.html");
      await page.waitForLoadState("networkidle");
      const s = await sceneState(page);
      const tag = `${vp.width}x${vp.height}`;
      expect(s.stageDisplay, `${tag}: .coffee-stage display`).toBe("none");
      expect(s.hidden, `${tag}: scene not shown`).toBe(true);
      await expect(page.locator(".coffee-egg").first(), `${tag}: eggs not reachable`).toBeHidden();
      await expect(page.locator(`main a[href="${CALENDAR_URL}"]`).first(), `${tag}: booking link still on screen`).toBeInViewport();
    }
    // And at 500px it is back (when there is room for 3x).
    await page.setViewportSize({ width: sizes[0].width, height: 500 });
    await expect.poll(async () => (await sceneState(page)).stageDisplay).not.toBe("none");
  });

  test("tight screens on first load (320x568, 600x520): the scene never covers the card", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile project only");
    for (const vp of [{ width: 320, height: 568 }, { width: 600, height: 520 }]) {
      await page.setViewportSize(vp);
      await page.goto("/contact.html");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      const tag = `${vp.width}x${vp.height}`;
      const m = await page.evaluate(() => {
        const st = document.querySelector(".coffee-stage"), w = document.querySelector(".coffee-scene");
        const wr = w.getBoundingClientRect(), cr = document.querySelector("#contact").getBoundingClientRect();
        return { stageH: st.clientHeight, shown: !w.hidden && wr.height > 0, sceneTop: Math.round(wr.top), cardBottom: Math.round(cr.bottom), sh: document.documentElement.scrollHeight, ih: innerHeight };
      });
      expect(m.sh, `${tag}: no scroll`).toBeLessThanOrEqual(m.ih);
      // Shown or hidden is the page's call; it must never cover the card.
      if (m.shown) expect(m.sceneTop - m.cardBottom, `${tag}: scene top ${m.sceneTop} vs card bottom ${m.cardBottom}`).toBeGreaterThanOrEqual(16);
    }
  });

  test("animation starts only when shown; pauses when the scene is hidden and in a hidden tab", async ({ page }) => {
    const vw = (page.viewportSize() || { width: 375 }).width;
    const full = page.viewportSize() || { width: 375, height: 812 };
    await page.setViewportSize({ width: vw, height: 450 }); // under 500px the scene is hidden (display: none)
    await countDraws(page);
    const errs = watchErrors(page);
    await page.goto("/contact.html");
    await page.waitForLoadState("networkidle");
    expect((await sceneState(page)).hidden, "precondition: scene hidden on a short screen").toBe(true);
    expect(await drawsDuring(page, 500), "no frames drawn while the scene is hidden").toBe(0);

    await page.setViewportSize(full);
    await expect.poll(async () => (await sceneState(page)).hidden, { message: "scene shown at full height" }).toBe(false);
    await expect.poll(() => draws(page), { message: "starts drawing once shown" }).toBeGreaterThan(0);
    expect(await drawsDuring(page, 700), "keeps animating while shown").toBeGreaterThan(1);

    await page.setViewportSize({ width: vw, height: 450 });
    await page.waitForTimeout(250); // let the IntersectionObserver report
    expect(await drawsDuring(page, 600), "paused once the scene is hidden again").toBe(0);

    await page.setViewportSize(full);
    await expect.poll(() => drawsDuring(page, 300), { message: "resumes when shown again" }).toBeGreaterThan(0);
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
