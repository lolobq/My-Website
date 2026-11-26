// Unit tests for js/common.js and js/pages.js, run against the real pages inside jsdom.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./load-page.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const norm = (s) => String(s || "").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const navLabels = (doc) =>
  [...doc.querySelectorAll("#site-header nav a, header nav a")]
    .filter((a) => !a.hidden && !a.closest("[hidden]") && a.style.display !== "none")
    .map((a) => norm(a.textContent));

const POST = (o = {}) => ({ slug: "a", title: "A", date: "2026-11-01", tags: ["tech"], excerpt: "Ex.", body: ["x"], ...o });
// Force an empty POSTS list (runs right after js/content.js), so empty-state tests
// do not depend on whatever posts content.js currently ships.
const NO_POSTS = (w) => { w.POSTS = []; };
const ON_MAIN = process.env.GITHUB_REF === "refs/heads/main";
const WIDE = (q) => /min-width: 768px/.test(q) && /pointer: fine/.test(q);
const REDUCE = (q) => /prefers-reduced-motion: reduce/.test(q);

describe("nav", () => {
  it("shows Reflections even while window.POSTS is empty (Lauren's call), with capitalized coffee label", () => {
    const { doc } = loadPage("about.html", { before: (w) => { w.POSTS = []; } });
    expect(navLabels(doc)).toEqual(["Resume", "Projects", "About", "Reflections", "Speaking", "Let's Get Coffee"]);
    expect(doc.querySelector('header nav a[href="reflections.html"]')).not.toBeNull();
  });

  it("shows Reflections even when window.POSTS is missing", () => {
    const { doc } = loadPage("about.html", { before: (w) => { delete w.POSTS; } });
    expect(navLabels(doc)).toContain("Reflections");
  });

  it("shows Reflections after About once a post exists", () => {
    const { doc } = loadPage("about.html", { before: (w) => { w.POSTS = [POST()]; } });
    expect(navLabels(doc)).toEqual(["Resume", "Projects", "About", "Reflections", "Speaking", "Let's Get Coffee"]);
  });

  it("marks the current page with aria-current", () => {
    const { doc } = loadPage("projects.html");
    const cur = doc.querySelectorAll('header nav a[aria-current="page"]');
    expect(cur.length).toBe(1);
    expect(cur[0].getAttribute("href")).toMatch(/projects\.html$/);
  });

  it("contact page nav shows Let's Get Coffee as current", () => {
    const { doc } = loadPage("contact.html");
    expect(navLabels(doc)).toContain("Let's Get Coffee");
  });
});

describe("resume (just the PDF)", () => {
  it("has no dynamic/document toggle", () => {
    const { doc } = loadPage("resume.html");
    expect(doc.querySelector("#resume-dynamic, #dynamic, [data-view]")).toBeNull();
    expect(doc.querySelector("#document")).not.toBeNull();
  });

  it("one stone slab: Open my resume (PDF) (target _blank, rel noopener) and Download PDF (download attr)", () => {
    const { doc } = loadPage("resume.html");
    const slab = doc.querySelectorAll("#document .resume-fallback");
    expect(slab.length).toBe(1);
    expect(slab[0].classList.contains("stone")).toBe(true);
    const links = [...slab[0].querySelectorAll("a")];
    expect(links.map((a) => norm(a.textContent))).toEqual(["Open my resume (PDF)", "Download PDF"]);
    const [open, dl] = links;
    expect(open.getAttribute("href")).toMatch(/assets\/resume\.pdf$/);
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.getAttribute("rel")).toMatch(/noopener/);
    expect(dl.getAttribute("href")).toMatch(/assets\/resume\.pdf$/);
    expect(dl.hasAttribute("download")).toBe(true);
  });

  it("retired: no button bar, no Open in new tab, no <details> text version", () => {
    const { doc } = loadPage("resume.html");
    expect(doc.querySelector(".resume-actions, .resume-head, details")).toBeNull();
    expect([...doc.querySelectorAll("main a")].some((a) => /open in new tab/i.test(a.textContent))).toBe(false);
  });

  it("h1 #resume-heading is sr-only and focusable (tabindex -1)", () => {
    const { doc } = loadPage("resume.html");
    const h = doc.querySelector("#document h1#resume-heading");
    expect(h).not.toBeNull();
    expect(h.classList.contains("sr-only")).toBe(true);
    expect(h.getAttribute("tabindex")).toBe("-1");
    expect(norm(h.textContent)).not.toBe("");
  });

  it("text version is a real-HTML sr-only <article>; its links skip the Tab order", () => {
    const { doc } = loadPage("resume.html");
    const art = doc.querySelector("article#resume-document");
    expect(art).not.toBeNull();
    expect(art.classList.contains("sr-only")).toBe(true);
    expect(art.closest("#document")).toBeNull();
    expect(norm(art.textContent).length).toBeGreaterThan(500);
    expect([...art.querySelectorAll("h2")].map((h) => h.textContent)).toContain("Experience");
    const links = [...art.querySelectorAll("a")];
    expect(links.filter((a) => a.getAttribute("tabindex") !== "-1").map((a) => a.getAttribute("href"))).toEqual([]);
  });

  it("the iframe goes in the stone frame slot, and the slab hides via has-pdf-frame", () => {
    const { doc } = loadPage("resume.html", { media: WIDE, pdfViewer: true });
    const f = doc.querySelector("#document iframe");
    expect(f.closest(".resume-frame-slot.stone")).not.toBeNull();
    expect(doc.body.classList.contains("has-pdf-frame")).toBe(true);
  });

  it("embeds the PDF in an iframe on wide fine-pointer screens with a PDF viewer", () => {
    const { doc } = loadPage("resume.html", { media: WIDE, pdfViewer: true });
    const f = doc.querySelector("#document iframe");
    expect(f).not.toBeNull();
    expect(f.getAttribute("src")).toMatch(/^assets\/resume\.pdf#/);
    expect(f.getAttribute("title")).toMatch(/PDF/);
    expect(doc.body.classList.contains("has-pdf-frame")).toBe(true);
  });

  it("no iframe on narrow or touch screens", () => {
    const { doc } = loadPage("resume.html", { media: () => false, pdfViewer: true });
    expect(doc.querySelector("iframe")).toBeNull();
    expect(doc.body.classList.contains("has-pdf-frame")).toBe(false);
  });

  it("no iframe when the browser has no PDF viewer", () => {
    const { doc } = loadPage("resume.html", { media: WIDE, pdfViewer: false });
    expect(doc.querySelector("iframe")).toBeNull();
  });

  it("adds/removes the iframe when the media query changes", () => {
    const { doc, setMedia } = loadPage("resume.html", { media: WIDE, pdfViewer: true });
    expect(doc.querySelector("#document iframe")).not.toBeNull();
    setMedia(() => false);
    expect(doc.querySelector("#document iframe")).toBeNull();
    setMedia(WIDE);
    expect(doc.querySelectorAll("#document iframe").length).toBe(1);
  });

  it("#document focuses the resume heading (and again on hashchange)", () => {
    const { win, doc } = loadPage("resume.html", { hash: "#document" });
    expect(doc.activeElement && doc.activeElement.id).toBe("resume-heading");
    doc.body.focus();
    win.dispatchEvent(new win.HashChangeEvent("hashchange"));
    expect(doc.activeElement.id).toBe("resume-heading");
  });

  it("does not steal focus without #document", () => {
    const { doc } = loadPage("resume.html");
    expect(doc.activeElement && doc.activeElement.id).not.toBe("resume-heading");
  });

  describe("phone highlight slabs", () => {
    it("Experience, Skills, Publications, Education groups after the Open/Download slab; no summary, no honors", () => {
      const { win, doc } = loadPage("resume.html");
      const R = win.RESUME;
      const slabs = doc.querySelector("#document .resume-slabs");
      expect(slabs).not.toBeNull();
      expect(slabs.previousElementSibling.classList.contains("resume-fallback")).toBe(true);
      const groups = [...slabs.querySelectorAll(":scope > section.resume-group")];
      expect(groups.map((g) => norm(g.querySelector("h2.resume-kicker").textContent))).toEqual(["Experience", "Skills", "Publications", "Education"]);
      for (const g of groups) expect(doc.getElementById(g.getAttribute("aria-labelledby"))).toBe(g.querySelector("h2"));
      expect(groups[0].querySelectorAll(".resume-slab.stone").length).toBe(R.experience.length);
      expect(groups[3].querySelectorAll(".resume-slab.stone").length).toBe(R.education.length);
      expect(groups[1].querySelectorAll(".doc-skills li").length).toBe(R.skills.length);
      expect(groups[2].querySelectorAll("li").length).toBe(R.publications.length);
      const text = norm(slabs.textContent);
      expect(text).not.toMatch(/disc\s*golf/i);
      for (const h of R.honors) expect(text).not.toContain(norm(h));
      expect(text).not.toContain(norm(R.summary).slice(0, 60));
      expect(text).not.toMatch(/\b(honors|summary)\b/i);
      // One source: the slab role text equals the text version's role text.
      const docRoles = [...doc.querySelectorAll("#resume-document section")].find((s) => s.querySelector("h2").textContent === "Experience").querySelectorAll("article");
      [...groups[0].querySelectorAll("article")].forEach((a, i) => expect(norm(a.textContent)).toBe(norm(docRoles[i].textContent)));
    });

    it("text version is aria-hidden while the slabs show; exposed with the PDF frame; toggles with the media query", () => {
      const { doc, setMedia } = loadPage("resume.html", { media: () => false, pdfViewer: true });
      const art = doc.querySelector("#resume-document");
      expect(art.getAttribute("aria-hidden")).toBe("true");
      setMedia(WIDE);
      expect(doc.querySelector("#document iframe")).not.toBeNull();
      expect(art.hasAttribute("aria-hidden")).toBe(false);
      setMedia(() => false);
      expect(art.getAttribute("aria-hidden")).toBe("true");
    });

    it("text version is exposed again while printing", () => {
      const { doc, setMedia } = loadPage("resume.html", { media: () => false });
      const art = doc.querySelector("#resume-document");
      expect(art.getAttribute("aria-hidden")).toBe("true");
      setMedia((q) => q === "print");
      expect(art.hasAttribute("aria-hidden")).toBe(false);
      setMedia(() => false);
      expect(art.getAttribute("aria-hidden")).toBe("true");
    });

    it("desktop with a viewer: aria-hidden never set", () => {
      const { doc } = loadPage("resume.html", { media: WIDE, pdfViewer: true });
      expect(doc.querySelector("#resume-document").hasAttribute("aria-hidden")).toBe(false);
    });

    it("no slabs (empty resume content): text version stays exposed", () => {
      const { doc } = loadPage("resume.html", { before: (w) => { w.RESUME = { title: "Resume" }; } });
      expect(doc.querySelector(".resume-slabs")).toBeNull();
      expect(doc.querySelector("#resume-document").hasAttribute("aria-hidden")).toBe(false);
    });
  });

  it("print events do not throw or change the DOM (CSS un-hides the text version)", () => {
    const { win, doc, errors } = loadPage("resume.html");
    const before = doc.querySelector("#resume").innerHTML;
    win.dispatchEvent(new win.Event("beforeprint"));
    win.dispatchEvent(new win.Event("afterprint"));
    expect(doc.querySelector("#resume").innerHTML).toBe(before);
    expect(errors.map(String)).toEqual([]);
  });
});

describe("reflections", () => {
  const pressed = (doc) => [...doc.querySelectorAll(".tag-filter button")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent);
  const titles = (doc) => [...doc.querySelectorAll(".post-link")].map((a) => a.textContent);

  it("empty state with All + every tag from window.TAGS", () => {
    const { win, doc } = loadPage("reflections.html", { before: NO_POSTS });
    const labels = [...doc.querySelectorAll(".tag-filter button")].map((b) => b.textContent);
    expect(labels).toEqual(["All", ...win.TAGS.map((t) => t.label)]);
    expect(pressed(doc)).toEqual(["All"]);
    expect(doc.querySelector(".post-empty").textContent).toMatch(/no reflections yet/i);
    expect(doc.querySelector(".tag-filter").getAttribute("role")).toBe("group");
    expect(doc.querySelector(".post-results").getAttribute("aria-live")).toBe("polite");
  });

  it("?tag= deep link presses that filter; empty tag state links back to all", () => {
    const { doc } = loadPage("reflections.html", { hash: "?tag=health", before: NO_POSTS });
    expect(pressed(doc)).toEqual(["Health & Wellness"]);
    expect(doc.querySelector(".post-empty").textContent).toMatch(/Nothing tagged Health & Wellness yet/);
    expect(doc.querySelector(".post-empty a").getAttribute("href")).toBe("reflections.html");
  });

  it("unknown ?tag= falls back to All", () => {
    const { doc } = loadPage("reflections.html", { hash: "?tag=bogus" });
    expect(pressed(doc)).toEqual(["All"]);
  });

  it("lists posts newest first with date, reading time and tag chips", () => {
    const { doc } = loadPage("reflections.html", {
      before: (w) => { w.POSTS = [POST({ slug: "old", title: "Old", date: "2025-01-01" }), POST({ slug: "new", title: "New", date: "2026-11-01", tags: ["philosophy"] })]; },
    });
    expect(titles(doc)).toEqual(["New", "Old"]);
    const first = doc.querySelector(".post-card");
    expect(first.querySelector("time").getAttribute("datetime")).toBe("2026-11-01");
    expect(first.textContent).toMatch(/1 min read/);
    const chip = first.querySelector(".tag-chip");
    expect(chip.textContent).toBe("Philosophy");
    expect(chip.getAttribute("href")).toBe("reflections.html?tag=philosophy");
    expect(doc.querySelector(".post-link").getAttribute("href")).toBe("reflections.html?post=new");
  });

  it("filter click pushes ?tag=, updates aria-pressed; popstate re-renders", () => {
    const { win, doc } = loadPage("reflections.html", {
      before: (w) => { w.POSTS = [POST({ slug: "t", title: "T", tags: ["tech"] }), POST({ slug: "p", title: "P", tags: ["philosophy"] })]; },
    });
    const btn = (label) => [...doc.querySelectorAll(".tag-filter button")].find((b) => b.textContent === label);
    btn("Tech").click();
    expect(win.location.search).toBe("?tag=tech");
    expect(pressed(doc)).toEqual(["Tech"]);
    expect(titles(doc)).toEqual(["T"]);
    btn("Tech").click(); // already selected: no new history entry
    expect(win.history.length).toBe(2);
    btn("All").click();
    expect(win.location.search).toBe("");
    expect(titles(doc).sort()).toEqual(["P", "T"]);
    win.history.replaceState(null, "", "reflections.html?tag=philosophy");
    win.dispatchEvent(new win.PopStateEvent("popstate"));
    expect(pressed(doc)).toEqual(["Philosophy"]);
    expect(titles(doc)).toEqual(["P"]);
  });

  it("reading time counts every block (~220 wpm)", () => {
    const words = Array(660).fill("w").join(" ");
    const { doc } = loadPage("reflections.html", { before: (w) => { w.POSTS = [POST({ body: [words, { h: "x" }, { list: ["y"] }] })]; } });
    expect(doc.querySelector(".post-card").textContent).toMatch(/3 min read/);
  });

  describe("post page", () => {
    const load = (body, extra = {}) =>
      loadPage("reflections.html", { hash: "?post=a", before: (w) => { w.POSTS = [POST({ body, ...extra })]; } });

    it("sets title, og:title and description from the post", () => {
      const { doc } = load(["x"], { title: "Hello", excerpt: "Short." });
      expect(doc.title).toBe("Hello · Reflections");
      expect(doc.querySelector("meta[property='og:title']").getAttribute("content")).toBe("Hello · Reflections");
      expect(doc.querySelector("meta[name='description']").getAttribute("content")).toBe("Short.");
      expect(doc.querySelector("meta[property='og:description']").getAttribute("content")).toBe("Short.");
      expect(doc.querySelector("h1").textContent).toBe("Hello");
    });

    it("renders **bold**, *italic* and links; external links get target=_blank rel=noopener", () => {
      const { doc } = load(["**B** and *I* [ext](https://example.com/a?b=1&c=2) [int](about.html) [mail](mailto:x@y.z)"]);
      const p = doc.querySelector(".post-body p");
      expect(p.querySelector("strong").textContent).toBe("B");
      expect(p.querySelector("em").textContent).toBe("I");
      const [ext, int, mail] = p.querySelectorAll("a");
      expect(ext.getAttribute("href")).toBe("https://example.com/a?b=1&c=2");
      expect(ext.getAttribute("target")).toBe("_blank");
      expect(ext.getAttribute("rel")).toBe("noopener");
      expect(int.getAttribute("href")).toBe("about.html");
      expect(int.hasAttribute("target")).toBe(false);
      expect(mail.getAttribute("href")).toBe("mailto:x@y.z");
    });

    it("escapes HTML in every block type (no injection)", () => {
      const evil = '<img src=x onerror="alert(1)"><script>bad()</script>';
      const { doc } = load([evil, { h: evil }, { quote: evil, cite: evil }, { list: [evil] }], { title: evil });
      const art = doc.querySelector("article.post");
      expect(art.querySelectorAll("img, script").length).toBe(0);
      expect(art.querySelector(".post-body p").textContent).toBe(evil);
      expect(art.querySelector(".post-body h2").textContent).toBe(evil);
      expect(art.querySelector("blockquote").textContent).toBe(evil);
      expect(art.querySelector("figcaption").textContent).toBe(evil);
      expect(art.querySelector(".post-body li").textContent).toBe(evil);
      expect(art.querySelector("h1").textContent).toBe(evil);
    });

    it("drops javascript: and attribute-breaking URLs", () => {
      const { doc } = load(['[a](javascript:alert(1)) [b](https://x.com/"onmouseover="alert(1))']);
      const p = doc.querySelector(".post-body p");
      expect(p.querySelector('a[href^="javascript" i]')).toBeNull();
      expect(p.textContent.startsWith("a"), "javascript: link text kept as plain text").toBe(true);
      expect(p.querySelectorAll("a").length).toBe(1);
      for (const a of p.querySelectorAll("a")) expect(a.getAttributeNames().sort()).toEqual(["href", "rel", "target"]);
    });

    it("reading card link has rel=noopener; image blocks are lazy with alt", () => {
      const { doc } = load([{ img: "assets/img/surgery.webp", alt: "Alt text" }], { reading: { title: "Book", author: "Au", href: "https://example.com/b" } });
      const a = doc.querySelector(".reading-card a");
      expect(a.getAttribute("rel")).toBe("noopener");
      expect(a.getAttribute("target")).toBe("_blank");
      expect(doc.querySelector(".reading-author").textContent).toBe("Au");
      const img = doc.querySelector(".post-img img");
      expect(img.getAttribute("alt")).toBe("Alt text");
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("width")).toBe("600");
    });

    it("unknown ?post= falls back to the list", () => {
      const { doc } = loadPage("reflections.html", { hash: "?post=nope", before: (w) => { w.POSTS = [POST()]; } });
      expect(doc.querySelector(".post-list")).not.toBeNull();
    });
  });
});

describe("projects", () => {
  const TILE_KEYS = ["smartcity", "capstone", "stealth-ai-startup", "job-search-agent-mcp-server"];
  const untyped = (doc) => [...doc.querySelectorAll(".tiles .tw-rest")].filter((e) => e.textContent).length;

  it("renders four tiles in TILE_KEYS order and the rest as Also exploring", () => {
    const { doc } = loadPage("projects.html");
    const hrefs = [...doc.querySelectorAll(".tiles > li.tile a.tile-link")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(TILE_KEYS.map((k) => `#${k}`));
    const also = doc.querySelector(".also");
    expect(also.textContent).toMatch(/^Also exploring:/);
    expect(also.querySelectorAll("a[data-panel]").length).toBeGreaterThan(0);
    for (const a of also.querySelectorAll("a[data-panel]")) expect(TILE_KEYS).not.toContain(a.dataset.panel);
  });

  it("one dialog per project, labelled by its heading, with a Close button", () => {
    const { doc } = loadPage("projects.html");
    const dialogs = [...doc.querySelectorAll("dialog.project-panel")];
    const links = doc.querySelectorAll("a[data-panel]");
    expect(dialogs.length).toBe(links.length);
    for (const d of dialogs) {
      expect(doc.getElementById(d.getAttribute("aria-labelledby"))).not.toBeNull();
      expect(d.querySelector("button[data-close]").textContent).toBe("Close");
    }
  });

  it("no On the workbench section", () => {
    const { doc } = loadPage("projects.html");
    expect([...doc.querySelectorAll("h2, h3")].some((h) => /on the workbench/i.test(h.textContent))).toBe(false);
  });

  it("tile text is available to screen readers immediately (sr-only copy)", () => {
    const { doc } = loadPage("projects.html");
    const first = doc.querySelector(".tile-link");
    expect(first.querySelector(".tw").getAttribute("aria-hidden")).toBe("true");
    expect(first.querySelector(".sr-only").textContent).toMatch(/smartcity/i);
  });

  it("entrance typing starts empty and finishes at once on keydown", () => {
    const { win, doc } = loadPage("projects.html");
    expect(doc.querySelector(".tiles").classList.contains("is-entering")).toBe(true);
    expect(untyped(doc)).toBeGreaterThan(0);
    win.dispatchEvent(new win.KeyboardEvent("keydown", { key: "a" }));
    expect(untyped(doc)).toBe(0);
    expect(doc.querySelector(".tiles").classList.contains("is-entering")).toBe(false);
  });

  it.each(["scroll", "pointerdown", "wheel", "touchstart"])("entrance typing finishes on %s", (ev) => {
    const { win, doc } = loadPage("projects.html");
    win.dispatchEvent(new win.Event(ev));
    expect(untyped(doc)).toBe(0);
  });

  it("reduced motion shows everything immediately", () => {
    const { doc } = loadPage("projects.html", { media: REDUCE });
    expect(doc.querySelector(".tiles").classList.contains("is-entering")).toBe(false);
    expect(untyped(doc)).toBe(0);
  });

  it("clicking a tile opens its dialog and pushes #key; Close returns focus to the tile", () => {
    const { win, doc } = loadPage("projects.html");
    const link = doc.querySelector('a[data-panel="capstone"]');
    link.click();
    const d = doc.getElementById("capstone");
    expect(d.open).toBe(true);
    expect(win.location.hash).toBe("#capstone");
    expect(untyped(doc)).toBe(0);
    d.querySelector("[data-close]").click();
    expect(d.open).toBe(false);
    expect(doc.activeElement).toBe(link);
  });

  it("backdrop click (target is the dialog) closes it", () => {
    const { doc } = loadPage("projects.html");
    doc.querySelector('a[data-panel="smartcity"]').click();
    const d = doc.getElementById("smartcity");
    d.dispatchEvent(new d.ownerDocument.defaultView.MouseEvent("click", { bubbles: true }));
    expect(d.open).toBe(false);
  });

  it("#key deep link opens that panel on load; hashchange to another key swaps panels", () => {
    const { win, doc } = loadPage("projects.html", { hash: "#job-search-agent-mcp-server" });
    expect(doc.getElementById("job-search-agent-mcp-server").open).toBe(true);
    expect(doc.querySelector(".tiles").classList.contains("is-entering")).toBe(false);
    win.location.hash = "#capstone";
    win.dispatchEvent(new win.HashChangeEvent("hashchange"));
    expect(doc.getElementById("capstone").open).toBe(true);
    expect(doc.querySelectorAll("dialog[open]").length).toBe(1);
  });

  it("unknown #hash opens nothing; popstate to no hash closes an open panel", () => {
    const { win, doc } = loadPage("projects.html", { hash: "#nope" });
    expect(doc.querySelectorAll("dialog[open]").length).toBe(0);
    win.location.hash = "#capstone";
    win.dispatchEvent(new win.HashChangeEvent("hashchange"));
    expect(doc.getElementById("capstone").open).toBe(true);
    win.history.replaceState(null, "", "projects.html");
    win.dispatchEvent(new win.PopStateEvent("popstate"));
    expect(doc.querySelectorAll("dialog[open]").length).toBe(0);
  });

  describe("queue", () => {
    const st = (doc) => {
      const ts = [...doc.querySelectorAll(".tiles > li.tile")];
      return {
        at: ts.findIndex((t) => t.classList.contains("is-current")),
        currents: ts.filter((t) => t.classList.contains("is-current")).length,
        inert: ts.map((t) => t.hasAttribute("inert")),
        cssAt: doc.querySelector(".tiles").style.getPropertyValue("--at"),
        dots: [...doc.querySelectorAll(".queue-dot")].map((d) => d.getAttribute("aria-current")),
        prev: doc.querySelector('.queue-arrow[data-step="-1"]').getAttribute("aria-disabled"),
        next: doc.querySelector('.queue-arrow[data-step="1"]').getAttribute("aria-disabled"),
        count: doc.querySelector(".queue-count").textContent,
        status: doc.querySelector(".queue-status").textContent,
      };
    };
    const expectAt = (doc, i, status) => {
      const s = st(doc);
      expect(s.at).toBe(i);
      expect(s.currents).toBe(1);
      expect(s.inert).toEqual(TILE_KEYS.map((_, k) => k !== i));
      expect(s.cssAt).toBe(String(i));
      expect(s.dots).toEqual(TILE_KEYS.map((_, k) => (k === i ? "true" : null)));
      expect(s.prev).toBe(i === 0 ? "true" : null);
      expect(s.next).toBe(i === TILE_KEYS.length - 1 ? "true" : null);
      expect(s.count).toBe(`${i + 1} of ${TILE_KEYS.length}`);
      if (status !== undefined) expect(s.status).toBe(status);
    };
    const label = (doc, i) => doc.querySelectorAll(".queue-dot")[i].getAttribute("aria-label");
    const wheel = (win, init) => win.dispatchEvent(new win.WheelEvent("wheel", { deltaMode: 0, ...init }));
    const touch = (win, el, type, x, y) => {
      const e = new win.Event(type, { bubbles: true });
      const pt = [{ clientX: x, clientY: y }];
      Object.defineProperty(e, type === "touchend" ? "changedTouches" : "touches", { value: pt });
      el.dispatchEvent(e);
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    it("starts at tile 0: carousel region, polite silent status, neighbours inert, Previous disabled", () => {
      const { doc } = loadPage("projects.html");
      const q = doc.querySelector("section.queue");
      expect(q.getAttribute("role")).toBe("region");
      expect(q.getAttribute("aria-roledescription")).toBe("carousel");
      expect(q.getAttribute("aria-label")).toBe("Projects");
      const status = q.querySelector(".queue-status");
      expect(status.getAttribute("aria-live")).toBe("polite");
      expect(status.classList.contains("sr-only")).toBe(true);
      expect(q.querySelector(".queue-count").getAttribute("aria-hidden")).toBe("true");
      expectAt(doc, 0, "");
      [...q.querySelectorAll(".queue-dot")].forEach((d, i) => expect(d.getAttribute("aria-label")).toMatch(new RegExp(`^Project ${i + 1} of 4: \\S`)));
    });

    it("prev/next buttons and dots move it and announce; disabled arrows do nothing", () => {
      const { doc } = loadPage("projects.html");
      const [prev, next] = doc.querySelectorAll(".queue-arrow");
      prev.click();
      expectAt(doc, 0, "");
      for (let i = 1; i < 4; i++) { next.click(); expectAt(doc, i, label(doc, i)); }
      next.click();
      expectAt(doc, 3);
      doc.querySelectorAll(".queue-dot")[1].click();
      expectAt(doc, 1, label(doc, 1));
      prev.click();
      expectAt(doc, 0, label(doc, 0));
    });

    it("keys on the queue: ArrowRight/Left, PageDown/Up, End/Home; modifiers ignored; focus follows", () => {
      const { win, doc } = loadPage("projects.html");
      const q = doc.querySelector(".queue");
      doc.querySelector(".tile.is-current .tile-link").focus();
      const key = (k, o = {}) => doc.activeElement.dispatchEvent(new win.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o }));
      for (const [k, i] of [["ArrowRight", 1], ["PageDown", 2], ["End", 3], ["PageUp", 2], ["ArrowLeft", 1], ["Home", 0]]) {
        key(k);
        expectAt(doc, i, label(doc, i));
        expect(doc.querySelectorAll(".tiles > li.tile")[i].contains(doc.activeElement), `${k}: focus on the centred tile`).toBe(true);
      }
      key("ArrowRight", { ctrlKey: true });
      key("ArrowRight", { altKey: true });
      expectAt(doc, 0);
      const ev = new win.KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true });
      q.dispatchEvent(ev);
      expect(ev.defaultPrevented, "handled keys don't scroll the page").toBe(true);
      const other = new win.KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
      q.dispatchEvent(other);
      expect(other.defaultPrevented).toBe(false);
    });

    it("wheel: one gesture = one tile, down = next; new gesture after quiet; ctrl+wheel (zoom) ignored", async () => {
      const { win, doc } = loadPage("projects.html");
      for (let k = 0; k < 10; k++) wheel(win, { deltaY: 30 });
      expectAt(doc, 1, label(doc, 1));
      await sleep(260);
      for (let k = 0; k < 6; k++) wheel(win, { deltaY: -60 });
      expectAt(doc, 0);
      await sleep(260);
      wheel(win, { deltaX: 50, deltaY: 10 }); // sideways wins
      expectAt(doc, 1);
      await sleep(260);
      wheel(win, { deltaY: 3, deltaMode: 1 }); // 3 lines = 48px
      expectAt(doc, 2);
      await sleep(260);
      wheel(win, { deltaY: 200, ctrlKey: true });
      expectAt(doc, 2);
      wheel(win, { deltaY: 20 });
      wheel(win, { deltaY: -20 }); // direction change resets the travel
      expectAt(doc, 2);
    });

    it("wheel and swipe are ignored while a dialog is open", async () => {
      const { win, doc } = loadPage("projects.html");
      doc.querySelector('.tile.is-current a[data-panel]').click();
      expect(doc.querySelector("dialog[open]")).not.toBeNull();
      wheel(win, { deltaY: 100 });
      const q = doc.querySelector(".queue");
      touch(win, q, "touchstart", 200, 200);
      touch(win, q, "touchend", 50, 200);
      expectAt(doc, 0);
    });

    it("swipe: left = next, right = previous, up = next; under 40px nothing", () => {
      const { win, doc } = loadPage("projects.html");
      const q = doc.querySelector(".queue");
      const swipe = (dx, dy) => { touch(win, q, "touchstart", 200, 300); touch(win, q, "touchend", 200 + dx, 300 + dy); };
      swipe(-100, 5);
      expectAt(doc, 1, label(doc, 1));
      swipe(0, -100);
      expectAt(doc, 2);
      swipe(100, 0);
      expectAt(doc, 1);
      swipe(30, 0);
      expectAt(doc, 1);
    });

    it("#hash deep link moves the queue quietly and instantly; it opens the dialog", () => {
      const { win, doc } = loadPage("projects.html", { hash: "#stealth-ai-startup" });
      expectAt(doc, 2, "");
      expect(doc.getElementById("stealth-ai-startup").open).toBe(true);
      expect(doc.querySelector(".tiles").classList.contains("no-slide"), "no-slide removed after the jump").toBe(false);
      win.location.hash = "#smartcity";
      win.dispatchEvent(new win.HashChangeEvent("hashchange"));
      expectAt(doc, 0, "");
    });

    it("an Also exploring deep link opens its panel and leaves the queue where it is", () => {
      const { doc } = loadPage("projects.html");
      doc.querySelectorAll(".queue-arrow")[1].click();
      doc.querySelector(".also a[data-panel]").click();
      expect(doc.querySelector("dialog[open]")).not.toBeNull();
      expectAt(doc, 1);
    });

    it("each tile has its TILE_ART image (decorative, sized); the stealth art is a local generic SVG", () => {
      const { doc } = loadPage("projects.html");
      const tiles = [...doc.querySelectorAll(".tiles > li.tile")];
      tiles.forEach((t, i) => {
        const img = t.querySelector(".tile-art > img");
        expect(img, TILE_KEYS[i]).not.toBeNull();
        expect(img.getAttribute("src")).toBe(`assets/img/projects/${TILE_KEYS[i]}.svg`);
        expect(img.getAttribute("alt")).toBe("");
        expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["160", "120"]);
        expect(t.firstElementChild.classList.contains("tile-art"), "art at the top of the tile").toBe(true);
      });
      const svg = readFileSync(resolve(ROOT, "assets/img/projects/stealth-ai-startup.svg"), "utf8");
      expect(svg.trim()).toMatch(/^<svg[\s>]/);
      expect(svg).not.toMatch(/<text\b|<image\b|data:image\/|https?:\/\/(?!www\.w3\.org\/)/i);
    });
  });

  it("workbench panels show a labelled placeholder when there is no media", () => {
    const { doc } = loadPage("projects.html");
    const phs = doc.querySelectorAll("dialog .wb-placeholder");
    expect(phs.length).toBeGreaterThan(0);
    for (const ph of phs) {
      expect(ph.getAttribute("role")).toBe("img");
      expect(norm(ph.getAttribute("aria-label"))).not.toBe("");
    }
  });
});

describe("contact", () => {
  it("h1 is Let's Get Coffee; calendar link first; email visible; no form", () => {
    const { win, doc } = loadPage("contact.html");
    expect(norm(doc.querySelector("main h1").textContent)).toBe("Let's Get Coffee");
    const first = doc.querySelector("main a[href]");
    expect(first.getAttribute("href")).toBe(win.SITE.calendar);
    expect(first.getAttribute("rel")).toMatch(/noopener/);
    expect(doc.querySelector(`main a[href^="mailto:"]`)).not.toBeNull();
    expect(doc.querySelector("form")).toBeNull();
  });
});

describe("content", () => {
  it("closing card CTA is Let's Grab Coffee and points at the calendar", () => {
    const { win } = loadPage("about.html");
    const cta = win.CARDS[win.CARDS.length - 1].cta;
    expect(norm(cta.label)).toBe("Let's Grab Coffee");
    expect(cta.href).toBe(win.SITE.calendar);
  });

  it("TAGS has unique ids", () => {
    const { win } = loadPage("about.html");
    const ids = win.TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Release guard: sample Reflections posts are approved for preview branches only.
  // Runs only on main; elsewhere it is skipped with this reason in the test name.
  it.skipIf(!ON_MAIN)("release guard: no sample posts ship to main (skipped unless GITHUB_REF=refs/heads/main)", () => {
    const { win } = loadPage("about.html");
    const samples = (win.POSTS || [])
      .filter((p) => String(p.slug || "").startsWith("sample-") || String(p.excerpt || "").startsWith("Sample post."))
      .map((p) => p.slug);
    expect(samples, "remove sample posts from js/content.js before merging to main").toEqual([]);
  });

  it("pages load without script errors", () => {
    for (const f of ["about.html", "resume.html", "projects.html", "reflections.html", "speaking.html", "contact.html"]) {
      const { errors } = loadPage(f);
      expect(errors.map(String), f).toEqual([]);
    }
  });
});
