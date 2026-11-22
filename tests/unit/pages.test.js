// Unit tests for js/common.js and js/pages.js, run against the real pages inside jsdom.
import { describe, it, expect } from "vitest";
import { loadPage } from "./load-page.js";

const norm = (s) => String(s || "").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const navLabels = (doc) =>
  [...doc.querySelectorAll("#site-header nav a, header nav a")]
    .filter((a) => !a.hidden && !a.closest("[hidden]") && a.style.display !== "none")
    .map((a) => norm(a.textContent));

const POST = (o = {}) => ({ slug: "a", title: "A", date: "2026-11-01", tags: ["tech"], excerpt: "Ex.", body: ["x"], ...o });
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
    const { win, doc } = loadPage("reflections.html");
    const labels = [...doc.querySelectorAll(".tag-filter button")].map((b) => b.textContent);
    expect(labels).toEqual(["All", ...win.TAGS.map((t) => t.label)]);
    expect(pressed(doc)).toEqual(["All"]);
    expect(doc.querySelector(".post-empty").textContent).toMatch(/no reflections yet/i);
    expect(doc.querySelector(".tag-filter").getAttribute("role")).toBe("group");
    expect(doc.querySelector(".post-results").getAttribute("aria-live")).toBe("polite");
  });

  it("?tag= deep link presses that filter; empty tag state links back to all", () => {
    const { doc } = loadPage("reflections.html", { hash: "?tag=health" });
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

  it("POSTS ships empty and TAGS has unique ids", () => {
    const { win } = loadPage("about.html");
    expect(win.POSTS).toEqual([]);
    const ids = win.TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("pages load without script errors", () => {
    for (const f of ["about.html", "resume.html", "projects.html", "reflections.html", "speaking.html", "contact.html"]) {
      const { errors } = loadPage(f);
      expect(errors.map(String), f).toEqual([]);
    }
  });
});
