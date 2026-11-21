// @ts-check
/*
 * Shared constants and helpers for the *.e2e.spec.js suites.
 * Selectors that depend on builder markup are collected here so they can be
 * adjusted in one place if the builder settles on different names.
 */
const { expect } = require("@playwright/test");

const CALENDAR_URL = "https://calendar.app.google/X2TgfwioqwVjECZS6";

/** Every shipped page. `nav` is the expected nav label marked aria-current on that page. */
const PAGES = [
  { name: "home", path: "/index.html", nav: null },
  { name: "resume", path: "/resume.html", nav: "Resume" },
  { name: "projects", path: "/projects.html", nav: "Projects" },
  { name: "about", path: "/about.html", nav: "About" },
  { name: "reflections", path: "/reflections.html", nav: null }, // Writing: hidden while POSTS is empty
  { name: "speaking", path: "/speaking.html", nav: "Speaking" },
  { name: "contact", path: "/contact.html", nav: "Let's get coffee" },
];

/** Visible nav order at launch (Writing hidden because window.POSTS is empty). */
const NAV_ORDER = ["Resume", "Projects", "About", "Speaking", "Let's get coffee"];

/** Normalise curly apostrophes and whitespace so "Let’s" == "Let's". */
const norm = (s) => String(s || "").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

const SEL = {
  nav: "#site-header nav, header nav",
  cards: "#story .card",
  scrollHint: "#scroll-hint",
  skipToWork: 'a[href$="resume.html#document"]',
  dynamic: "#dynamic",
  document: "#document",
};

/**
 * Collect console errors, uncaught page errors, failed requests and HTTP >= 400
 * responses. Call before page.goto(). Returns a live object.
 */
function watchErrors(page) {
  const out = { console: [], pageErrors: [], failed: [], badStatus: [] };
  page.on("console", (m) => {
    if (m.type() === "error") out.console.push(`${m.text()} @ ${m.location().url || "?"}`);
  });
  page.on("pageerror", (e) => out.pageErrors.push(String(e && e.stack ? e.stack.split("\n")[0] : e)));
  page.on("requestfailed", (r) => {
    const why = (r.failure() && r.failure().errorText) || "failed";
    // Aborted media range requests and navigations away are not real failures.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(why) && ["media", "document"].includes(r.resourceType())) return;
    out.failed.push(`${r.method()} ${r.url()} (${why})`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) out.badStatus.push(`${r.status()} ${r.url()}`);
  });
  return out;
}

function expectNoErrors(errs, where) {
  const all = [
    ...errs.console.map((s) => `console.error: ${s}`),
    ...errs.pageErrors.map((s) => `uncaught: ${s}`),
    ...errs.failed.map((s) => `request failed: ${s}`),
    ...errs.badStatus.map((s) => `HTTP ${s}`),
  ];
  expect(all, `${where}: console errors / failed requests`).toEqual([]);
}

/** Scroll the window to pct (0..100) of its scrollable height, instantly. */
async function scrollToPct(page, pct) {
  await page.evaluate((p) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.round((max * p) / 100), behavior: "instant" });
  }, pct);
}

/** Wait for two animation frames so scroll-linked state has been applied. */
async function frames(page, n = 2) {
  await page.evaluate(
    (k) =>
      new Promise((res) => {
        let i = 0;
        const tick = () => (++i >= k ? res(null) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n
  );
}

/** Indices of story cards that are currently exposed (not inert, not aria-hidden). */
async function activeCards(page) {
  return page.$$eval(SEL.cards, (els) =>
    els
      .map((el, i) => ({ i, el }))
      .filter(({ el }) => !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true" && !el.closest("[inert],[aria-hidden='true']"))
      .map(({ i }) => i)
  );
}

async function hasHorizontalScroll(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0) > window.innerWidth + 1;
  });
}

/** Elements wider than the viewport, for a useful failure message. */
async function overflowCulprits(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== "fixed") {
        out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} [${Math.round(r.left)}..${Math.round(r.right)}]`);
        if (out.length >= 8) break;
      }
    }
    return out;
  });
}

/**
 * Visible interactive controls smaller than min x min CSS px. Covers nav links,
 * buttons and button-styled links. Inline text links inside prose are exempt
 * (WCAG 2.5.8 inline exception).
 */
async function smallTapTargets(page, min = 44) {
  return page.evaluate((m) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const sel = "nav a, button, .btn, [role='button'], input, select, textarea, summary";
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest("[inert],[aria-hidden='true']")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue; // off-screen (e.g. skip link)
      if (r.width < m - 0.5 || r.height < m - 0.5) {
        const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
        out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  }, min);
}

module.exports = {
  CALENDAR_URL,
  PAGES,
  NAV_ORDER,
  SEL,
  norm,
  watchErrors,
  expectNoErrors,
  scrollToPct,
  frames,
  activeCards,
  hasHorizontalScroll,
  overflowCulprits,
  smallTapTargets,
};
