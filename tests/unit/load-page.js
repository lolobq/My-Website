// Load a shipped page and run its local <script src> files, in order, inside jsdom.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @param {string} file   e.g. "resume.html"
 * @param {{ hash?: string, before?: (win: any) => void }} [opts]
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
  win.matchMedia = win.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  win.scrollTo = () => {};
  win.HTMLElement.prototype.scrollIntoView = function () {};
  const srcs = [...win.document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")).filter((s) => !/^https?:/.test(s));
  for (const src of srcs) {
    if (src === "js/content.js") {
      win.eval(readFileSync(resolve(ROOT, src), "utf8"));
      if (opts.before) opts.before(win);
      continue;
    }
    win.eval(readFileSync(resolve(ROOT, src), "utf8"));
  }
  return { dom, win, doc: win.document, errors };
}
