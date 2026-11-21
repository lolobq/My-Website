#!/usr/bin/env node
/*
 * Broken-link check.
 *  1. linkinator crawls the static HTML from a local server (internal links, recursive;
 *     external links checked once each).
 *  2. Most links on this site are rendered by JS (header nav, cards, pages.js), which
 *     linkinator cannot see. So Playwright renders every page and every href/src in the
 *     final DOM is checked as well.
 * Hosts that block bots (LinkedIn, Google Calendar booking pages) are reported as SKIPPED,
 * not failed. mailto:/tel: links are skipped. Set LINKS_OFFLINE=1 to skip all external checks.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LinkChecker } from "linkinator";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const PORT = Number(process.env.LINKS_PORT || 4175);
const BASE = `http://127.0.0.1:${PORT}`;
const PAGES = ["index.html", "resume.html", "projects.html", "about.html", "reflections.html", "speaking.html", "contact.html"];
const SKIP_HOSTS = [/(^|\.)linkedin\.com$/i, /^calendar\.app\.google$/i];
const OFFLINE = !!process.env.LINKS_OFFLINE;

const isSkippedHost = (u) => {
  try { return SKIP_HOSTS.some((re) => re.test(new URL(u).hostname)); } catch { return false; }
};

async function startServer() {
  const bin = require.resolve("http-server/bin/http-server");
  const proc = spawn(process.execPath, [bin, ROOT, "-p", String(PORT), "-a", "127.0.0.1", "-c-1", "--silent"], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/index.html`)).ok) return proc; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error("http-server did not start");
}

async function check(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15_000);
  const opts = { redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (link-check)" } };
  try {
    let r = await fetch(url, { ...opts, method: "HEAD" });
    if (r.status === 405 || r.status === 403 || r.status === 404) r = await fetch(url, { ...opts, method: "GET" });
    return r.status;
  } catch (e) {
    return `error: ${e.name === "AbortError" ? "timeout" : e.message}`;
  } finally {
    clearTimeout(t);
  }
}

const server = await startServer();
const results = new Map(); // url -> { status, from:Set, state }
const note = (url, from, state, status) => {
  const r = results.get(url) || { from: new Set(), state, status };
  r.from.add(from);
  if (state === "BROKEN" || !results.has(url)) Object.assign(r, { state, status });
  results.set(url, r);
};

try {
  // 1. linkinator: static HTML.
  const checker = new LinkChecker();
  const static_ = await checker.check({
    path: PAGES.map((p) => `${BASE}/${p}`),
    recurse: true,
    timeout: 15_000,
    linksToSkip: (link) =>
      Promise.resolve(/^(mailto|tel|javascript):/i.test(link) || isSkippedHost(link) || (OFFLINE && !link.startsWith(BASE))),
  });
  for (const l of static_.links) {
    if (l.state === "SKIPPED") note(l.url, l.parent || "(root)", "SKIPPED", "-");
    else note(l.url, l.parent || "(root)", l.state === "BROKEN" ? "BROKEN" : "OK", l.status);
  }

  // 2. Rendered DOM.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const rendered = new Map();
  for (const p of PAGES) {
    await page.goto(`${BASE}/${p}`, { waitUntil: "networkidle" });
    const urls = await page.$$eval("a[href], img[src], link[href], script[src], iframe[src], source[src], video[src], video[poster], audio[src]", (els) =>
      els.flatMap((e) => ["href", "src", "poster"].map((a) => e.getAttribute(a) && e[a]).filter(Boolean))
    );
    // Also og:image.
    const og = await page.$$eval('meta[property="og:image"]', (m) => m.map((x) => new URL(x.getAttribute("content") || "", location.href).href));
    for (const u of [...urls, ...og]) {
      if (!rendered.has(u)) rendered.set(u, new Set());
      rendered.get(u).add(p);
    }
  }
  await browser.close();

  for (const [u0, from] of rendered) {
    const u = u0.split("#")[0];
    const src = [...from].join(", ");
    if (/^(mailto|tel|javascript|data|blob):/i.test(u)) continue;
    if (isSkippedHost(u)) { note(u, src, "SKIPPED", "bot-blocking host"); continue; }
    if (OFFLINE && !u.startsWith(BASE)) { note(u, src, "SKIPPED", "offline"); continue; }
    const prev = results.get(u);
    if (prev && prev.state !== "SKIPPED") { prev.from.add(src); continue; }
    const status = await check(u);
    note(u, src, typeof status === "number" && status < 400 ? "OK" : "BROKEN", status);
  }
} finally {
  server.kill();
}

const rows = [...results.entries()].map(([url, r]) => ({ url: url.replace(BASE, ""), ...r }));
const broken = rows.filter((r) => r.state === "BROKEN");
const skipped = rows.filter((r) => r.state === "SKIPPED" && !/^(mailto|tel):/i.test(r.url));
const internal = rows.filter((r) => r.url.startsWith("/"));
for (const r of skipped) console.log(`SKIP    ${r.url}  (${r.status}; check by hand)`);
for (const r of broken) console.error(`BROKEN  ${r.url}  status=${r.status}  from: ${[...r.from].join(", ")}`);
console.log(
  `\nlinks: ${rows.length} checked (${internal.length} internal), ${broken.length} broken, ${skipped.length} skipped${OFFLINE ? " (offline mode)" : ""}`
);
process.exit(broken.length ? 1 : 0);
