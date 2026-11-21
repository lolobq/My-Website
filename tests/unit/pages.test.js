// Target behavior from CLAUDE.md; written ahead of the builder's implementation.
import { describe, it, expect } from "vitest";
import { loadPage } from "./load-page.js";

const navLabels = (doc) =>
  [...doc.querySelectorAll("#site-header nav a, header nav a")]
    .filter((a) => !a.hidden && !a.closest("[hidden]") && a.style.display !== "none")
    .map((a) => a.textContent.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim());

describe("nav", () => {
  it("hides Writing while window.POSTS is empty", () => {
    const { doc } = loadPage("about.html", { before: (w) => { w.POSTS = []; } });
    expect(navLabels(doc)).toEqual(["Resume", "Projects", "About", "Speaking", "Let's get coffee"]);
  });

  it("shows Writing once a post exists", () => {
    const { doc } = loadPage("about.html", {
      before: (w) => { w.POSTS = [{ slug: "a", title: "A", date: "2026-11-01", body: ["x"] }]; },
    });
    expect(navLabels(doc)).toContain("Writing");
  });

  it("marks the current page with aria-current", () => {
    const { doc } = loadPage("projects.html");
    const cur = doc.querySelectorAll('header nav a[aria-current="page"]');
    expect(cur.length).toBe(1);
    expect(cur[0].getAttribute("href")).toMatch(/projects\.html$/);
  });
});

describe("resume views", () => {
  const visible = (el) => !!el && !el.hidden && !el.closest("[hidden]");

  it("defaults to the dynamic view", () => {
    const { doc } = loadPage("resume.html");
    expect(visible(doc.getElementById("dynamic"))).toBe(true);
    expect(visible(doc.getElementById("document"))).toBe(false);
  });

  it("#document shows the document view and focuses its heading", () => {
    const { doc } = loadPage("resume.html", { hash: "#document" });
    expect(visible(doc.getElementById("document"))).toBe(true);
    expect(visible(doc.getElementById("dynamic"))).toBe(false);
    expect(doc.activeElement && /^H[1-3]$/.test(doc.activeElement.tagName)).toBe(true);
  });

  it("switches views on hashchange (back/forward)", () => {
    const { win, doc } = loadPage("resume.html", { hash: "#document" });
    win.location.hash = "#dynamic";
    win.dispatchEvent(new win.HashChangeEvent("hashchange"));
    expect(visible(doc.getElementById("dynamic"))).toBe(true);
    expect(visible(doc.getElementById("document"))).toBe(false);
  });

  it("Download PDF links to assets/resume.pdf with download attribute", () => {
    const { doc } = loadPage("resume.html");
    const a = [...doc.querySelectorAll("a")].find((x) => /download pdf/i.test(x.textContent));
    expect(a).toBeTruthy();
    expect(a.getAttribute("href")).toMatch(/assets\/resume\.pdf$/);
    expect(a.hasAttribute("download")).toBe(true);
  });
});
