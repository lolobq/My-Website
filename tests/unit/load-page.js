// Load a shipped page and run its local <script src> files, in order, inside jsdom.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Controllable matchMedia: `fn(query)` decides `matches`. The returned object keeps its
 * change listeners so a test can flip the result and fire `change` (see `setMedia`).
 */
function makeMatchMedia(win, fn) {
  const lists = [];
  const mm = (q) => {
    const listeners = new Set();
    const mql = {
      media: q,
      get matches() { return !!fn(q); },
      addEventListener: (t, cb) => { if (t === "change") listeners.add(cb); },
      removeEventListener: (t, cb) => listeners.delete(cb),
      addListener: (cb) => listeners.add(cb),
      removeListener: (cb) => listeners.delete(cb),
      _fire: () => listeners.forEach((cb) => cb({ matches: mql.matches, media: q })),
    };
    lists.push(mql);
    return mql;
  };
  mm._lists = lists;
  return mm;
}

/** Minimal HTMLDialogElement.showModal/close for jsdom (which lacks them). */
function polyfillDialog(win) {
  const P = win.HTMLDialogElement && win.HTMLDialogElement.prototype;
  if (!P) return;
  if (!P.showModal)
    P.showModal = function () {
      this.setAttribute("open", "");
      this._modal = true;
      const f = this.querySelector("button, a[href], [tabindex]");
      if (f) f.focus();
    };
  if (!P.close)
    P.close = function () {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this._modal = false;
      this.dispatchEvent(new win.Event("close"));
    };
  if (!Object.getOwnPropertyDescriptor(P, "open"))
    Object.defineProperty(P, "open", { get() { return this.hasAttribute("open"); }, configurable: true });
}

/**
 * @param {string} file   e.g. "resume.html"
 * @param {{
 *   hash?: string,                      // URL suffix: "#document", "?tag=tech", "?post=x"
 *   before?: (win: any) => void,        // runs right after js/content.js (override content)
 *   media?: (query: string) => boolean, // matchMedia result per query (default: false)
 *   pdfViewer?: boolean,                // navigator.pdfViewerEnabled
 * }} [opts]
 */
export function loadPage(file, opts = {}) {
  const html = readFileSync(resolve(ROOT, file), "utf8");
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(e));
  vc.on("error", (e) => errors.push(e));
  const dom = new JSDOM(html, {
    url: `http://localhost/${file}${opts.hash || ""}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const win = dom.window;
  const state = { media: opts.media || (() => false) };
  win.matchMedia = makeMatchMedia(win, (q) => state.media(q));
  if (opts.pdfViewer !== undefined)
    Object.defineProperty(win.navigator, "pdfViewerEnabled", { get: () => opts.pdfViewer, configurable: true });
  win.scrollTo = () => {};
  win.HTMLElement.prototype.scrollIntoView = function () {};
  polyfillDialog(win);
  const srcs = [...win.document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")).filter((s) => !/^https?:/.test(s));
  for (const src of srcs) {
    win.eval(readFileSync(resolve(ROOT, src), "utf8"));
    if (src === "js/content.js" && opts.before) opts.before(win);
  }
  /** Change what matchMedia returns and fire `change` on every list created so far. */
  const setMedia = (fn) => {
    state.media = fn;
    win.matchMedia._lists.forEach((l) => l._fire());
  };
  return { dom, win, doc: win.document, errors, setMedia };
}
