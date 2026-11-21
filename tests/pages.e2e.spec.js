// @ts-check
/*
 * Resume views, Projects workbench (journey 6), Coffee page, keyboard-only journey (journey 3).
 */
const { test, expect } = require("@playwright/test");
const { CALENDAR_URL, SEL, NAV_ORDER, norm } = require("./helpers");

/** The control that switches to a given view (link to #id, or a control with aria-controls=id). */
const toggleFor = (page, id) => page.locator(`main a[href$="#${id}"], main [aria-controls="${id}"]`).first();

async function expectView(page, shown) {
  const hidden = shown === "dynamic" ? "document" : "dynamic";
  await expect(page.locator(`#${shown}`), `#${shown} visible`).toBeVisible();
  await expect(page.locator(`#${hidden}`), `#${hidden} hidden`).toBeHidden();
  const state = await toggleFor(page, shown).evaluate((el) =>
    el.getAttribute("aria-pressed") || el.getAttribute("aria-selected") || el.getAttribute("aria-current") || el.getAttribute("aria-expanded")
  );
  expect(state, `toggle for #${shown} exposes its state (aria-pressed/selected/current)`).toMatch(/^(true|page|location)$/);
}

test.describe("resume", () => {
  test("defaults to the dynamic view", async ({ page }) => {
    await page.goto("/resume.html");
    await expectView(page, "dynamic");
  });

  test("toggle switches views; back/forward switch them back", async ({ page }) => {
    await page.goto("/resume.html");
    await toggleFor(page, "document").click();
    await expect(page).toHaveURL(/#document$/);
    await expectView(page, "document");
    await page.goBack();
    await expectView(page, "dynamic");
    await page.goForward();
    await expectView(page, "document");
  });

  test("document view is real HTML text", async ({ page }) => {
    await page.goto("/resume.html#document");
    const text = norm(await page.locator(SEL.document).innerText());
    expect(text.length).toBeGreaterThan(500);
    await expect(page.locator(`${SEL.document} iframe, ${SEL.document} embed, ${SEL.document} object`), "not a PDF embed").toHaveCount(0);
  });

  test("resume.html#document focuses the resume heading", async ({ page }) => {
    await page.goto("/resume.html#document");
    await expectView(page, "document");
    await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.tagName)).toMatch(/^H[1-3]$/);
  });

  test("view state survives navigating to another page and back", async ({ page }) => {
    await page.goto("/resume.html#document");
    await page.locator(SEL.nav).first().getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/projects\.html/);
    await page.goBack();
    await expectView(page, "document");
  });

  test("Download PDF link has download attribute and returns a PDF", async ({ page, request }) => {
    await page.goto("/resume.html");
    const pdf = page.getByRole("link", { name: /download pdf/i });
    await expect(pdf).toBeVisible();
    await expect(pdf).toHaveAttribute("download", /.*/);
    const res = await request.get(new URL((await pdf.getAttribute("href")) || "", page.url()).pathname);
    expect(res.status()).toBe(200);
  });
});

test.describe("projects", () => {
  test("two case studies", async ({ page }) => {
    await page.goto("/projects.html");
    await expect(page.getByRole("heading", { name: /smartcity/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /capstone/i }).first()).toBeVisible();
  });

  test("journey 6: On the workbench has exactly 3 cards with clean fixed-aspect placeholders", async ({ page }) => {
    await page.goto("/projects.html");
    await page.waitForLoadState("networkidle");
    const section = page.locator("section", { has: page.getByRole("heading", { name: /on the workbench/i }) }).last();
    await expect(section).toBeVisible();
    const cards = section.locator("article");
    await expect(cards).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      const slot = await card.evaluate((el) => {
        const all = [el, ...el.querySelectorAll("*")];
        const s = all.find((n) => getComputedStyle(n).aspectRatio !== "auto" && n.getBoundingClientRect().height > 40);
        if (!s) return null;
        const brokenImg = [...s.querySelectorAll("img")].some((im) => im.complete && im.naturalWidth === 0);
        const bareVideo = [...s.querySelectorAll("video")].some((v) => !v.getAttribute("poster") && !v.currentSrc);
        return { brokenImg, bareVideo, label: s.getAttribute("aria-label") || s.textContent || "" };
      });
      expect(slot, `workbench card ${i + 1} has a fixed aspect-ratio media slot`).not.toBeNull();
      expect(slot && slot.brokenImg, `card ${i + 1}: broken image`).toBe(false);
      expect(slot && slot.bareVideo, `card ${i + 1}: video without poster/src`).toBe(false);
    }
  });
});

test.describe("coffee page", () => {
  test("calendar link is primary, email visible, no form", async ({ page }) => {
    await page.goto("/contact.html");
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
    expect(names.some((n) => /skip to work/i.test(n)), "Tab reaches Skip to work").toBe(true);
    expect(seen.filter((s) => !s.ring).map((s) => s.name), "focused elements without a visible focus indicator").toEqual([]);
    expect(seen.filter((s) => s.hidden).map((s) => s.name), "focus landed inside inert/aria-hidden content").toEqual([]);
  });

  test("Enter on Scroll to reveal, then Skip to work -> resume -> coffee -> calendar link", async ({ page }) => {
    await page.goto("/index.html");
    await page.locator(SEL.scrollHint).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await page.goto("/index.html");
    await page.getByRole("link", { name: /skip to work/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/resume\.html#document$/);

    // Focus starts on the resume heading (below the header), so walk backwards to the nav.
    const seen = await tabWalk(page, 30, "Shift+Tab");
    for (const label of NAV_ORDER) expect(seen.map((s) => s.name), `Tab reaches "${label}" on resume`).toContain(label);
    await page.locator(SEL.nav).first().getByRole("link", { name: /let.s get coffee/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/contact\.html/);
    const onContact = await tabWalk(page, 20);
    expect(onContact.some((s) => s.href === CALENDAR_URL), "calendar link reachable by keyboard").toBe(true);
  });
});
