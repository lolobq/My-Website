// @ts-check
/*
 * Resume (PDF-first), Projects (stone tiles + dialogs, journey 6), Reflections (tags, filter,
 * fixture posts), Coffee page, keyboard-only journey (journey 3).
 */
const { test, expect } = require("@playwright/test");
const { CALENDAR_URL, SEL, NAV_ORDER, norm, watchErrors, expectNoErrors, injectPosts, FIXTURE_POSTS } = require("./helpers");

/** Headless Chromium has no PDF viewer; pretend it does so the desktop embed path runs. */
const forcePdfViewer = (page) =>
  page.addInitScript(() => Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", { get: () => true, configurable: true }));

test.describe("resume (PDF-first)", () => {
  test("dynamic/document toggle is retired", async ({ page }) => {
    await page.goto("/resume.html");
    await expect(page.locator("#resume-dynamic, #dynamic, [data-view]")).toHaveCount(0);
    await expect(page.locator(SEL.document)).toBeVisible();
  });

  test("Download PDF and Open in new tab links", async ({ page, request }) => {
    await page.goto("/resume.html");
    const dl = page.locator(SEL.document).getByRole("link", { name: /download pdf/i });
    const open = page.locator(SEL.document).getByRole("link", { name: /open in new tab/i });
    await expect(dl).toBeVisible();
    await expect(dl).toHaveAttribute("download", /.*/);
    await expect(dl).toHaveAttribute("href", /assets\/resume\.pdf$/);
    await expect(open).toBeVisible();
    await expect(open).toHaveAttribute("href", /assets\/resume\.pdf$/);
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", /noopener/);
    const res = await request.get(new URL((await dl.getAttribute("href")) || "", page.url()).pathname);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] || "").toMatch(/pdf/);
  });

  test("desktop with a fine pointer: PDF is embedded in an iframe inside #document", async ({ page }, testInfo) => {
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
    // Shrinking below the breakpoint removes the frame (matchMedia change listener).
    await page.setViewportSize({ width: 600, height: 900 });
    await expect(frame).toHaveCount(0);
    expectNoErrors(errs, "resume desktop embed");
  });

  test("desktop without a PDF viewer: no iframe, buttons still there", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "desktop-only");
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", { get: () => false, configurable: true }));
    await page.goto("/resume.html");
    await expect(page.locator(`${SEL.document} iframe`)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download pdf/i })).toBeVisible();
  });

  test("narrow / touch screen: no iframe, big buttons", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only");
    await forcePdfViewer(page); // even with a viewer, touch/narrow screens get no frame
    await page.goto("/resume.html#document");
    await expect(page.locator("iframe, embed, object"), "no PDF embed on narrow/touch screens").toHaveCount(0);
    for (const name of [/download pdf/i, /open in new tab/i]) {
      const box = await page.getByRole("link", { name }).boundingBox();
      expect(box && box.height >= 44 && box.width >= 44, `${name} is a big tap target (${box && Math.round(box.width)}x${box && Math.round(box.height)})`).toBe(true);
    }
  });

  test("HTML text version sits in a collapsed <details>", async ({ page }) => {
    await page.goto("/resume.html");
    const details = page.locator(SEL.resumeDetails);
    await expect(details).toHaveCount(1);
    expect(await details.evaluate((d) => /** @type {HTMLDetailsElement} */ (d).open), "collapsed by default").toBe(false);
    const text = page.locator(SEL.resumeText);
    await expect(text).toBeHidden();
    expect(norm(await text.textContent()).length, "real HTML resume text").toBeGreaterThan(500);
    await details.locator("summary").click();
    await expect(text).toBeVisible();
    await expect(text.getByRole("heading", { name: /experience/i })).toBeVisible();
  });

  test("resume.html#document focuses the resume heading", async ({ page }) => {
    await page.goto("/resume.html#document");
    await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe("resume-heading");
    expect(await page.evaluate(() => document.activeElement && document.activeElement.tagName)).toMatch(/^H[1-3]$/);
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
    const untyped = (page) => page.$$eval(".tiles .tw-rest", (els) => els.filter((e) => e.textContent).length);

    for (const how of ["scroll", "key", "tap"]) {
      test(`finishes at once on ${how}`, async ({ page }) => {
        await page.goto("/projects.html");
        await page.waitForTimeout(150);
        expect(await untyped(page), "still typing shortly after load").toBeGreaterThan(0);
        if (how === "scroll") await page.mouse.wheel(0, 50);
        else if (how === "key") await page.keyboard.press("Shift");
        else {
          const h = await page.locator(".projects-head h1").boundingBox();
          if (h) await page.mouse.click(h.x + 5, h.y + h.height / 2);
        }
        await expect.poll(() => untyped(page), { timeout: 500 }).toBe(0);
        await expect(page.locator(".tiles")).not.toHaveClass(/is-entering/);
        await expect(page.locator("dialog[open]")).toHaveCount(0);
      });
    }

    test("finishes on its own", async ({ page }) => {
      await page.goto("/projects.html");
      await expect.poll(() => untyped(page), { timeout: 5_000 }).toBe(0);
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

  test("empty: nav hidden, filter buttons, All pressed, empty state", async ({ page }) => {
    await page.goto("/reflections.html");
    await expect(page.locator(SEL.nav).first().getByRole("link", { name: /reflections|writing/i })).toHaveCount(0);
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
