// Unit tests for js/coffee.js (the Let's Get Coffee scene), run in jsdom with a recording
// 2D context and a controllable IntersectionObserver.
import { describe, it, expect } from "vitest";
import { loadPage } from "./load-page.js";

const REDUCE = (q) => /prefers-reduced-motion: reduce/.test(q);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Install fakes before js/coffee.js runs: a 2D context that records draw calls, and an
 * IntersectionObserver whose callback the test triggers. Returns the shared recorder.
 */
function setup({ io = true } = {}) {
  const rec = { draws: 0, fills: [], observers: [] };
  const before = (w) => {
    w.HTMLCanvasElement.prototype.getContext = function () {
      const canvas = this;
      const onScreen = () => !!(canvas.parentElement && canvas.parentElement.classList.contains("coffee-scene"));
      const ctx = {
        canvas,
        fillStyle: "#000",
        globalCompositeOperation: "source-over",
        globalAlpha: 1,
        imageSmoothingEnabled: false,
        drawImage() { if (onScreen()) rec.draws++; },
        fillRect(x, y, wd, h) { if (onScreen()) rec.fills.push({ x, y, w: wd, h, c: String(ctx.fillStyle) }); },
        clearRect() {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData() {},
        save() {},
        restore() {},
        beginPath() {},
        fill() {},
      };
      return ctx;
    };
    if (io) {
      w.IntersectionObserver = class {
        constructor(cb) { this.cb = cb; rec.observers.push(this); }
        observe(el) { this.el = el; }
        unobserve() {}
        disconnect() {}
        fire(isIntersecting) { this.cb([{ isIntersecting, target: this.el }]); }
      };
    } else {
      delete w.IntersectionObserver;
    }
  };
  return { rec, before };
}

/** Did the last frame paint white cells inside the heart rows (logical px 45..49, 15..18)? */
const heartCells = (fills) =>
  fills.filter((f) => /^rgba\(255,255,255,/.test(f.c.replace(/\s/g, "")) && f.x >= 45 && f.x <= 49 && f.y >= 15 && f.y <= 18).length;

describe("coffee scene: markup", () => {
  it("adds a role=img canvas with a label, two egg buttons and a polite live bubble in a stage after #contact", () => {
    const { before } = setup();
    const { doc, errors } = loadPage("contact.html", { before });
    const wrap = doc.querySelector("#contact + .coffee-stage > .coffee-scene");
    expect(wrap).not.toBeNull();
    const canvas = wrap.querySelector("canvas");
    expect(canvas.getAttribute("role")).toBe("img");
    expect(canvas.getAttribute("aria-label")).toMatch(/coffee/i);
    expect([canvas.width, canvas.height]).toEqual([96, 44]);
    const eggs = [...wrap.querySelectorAll("button.coffee-egg")];
    expect(eggs.length).toBe(2);
    for (const b of eggs) {
      expect(b.type).toBe("button");
      expect(b.getAttribute("aria-label")).toMatch(/\S/);
      expect(b.textContent.trim()).toBe("");
      expect(b.style.left).toMatch(/%$/);
      expect(b.style.width).toMatch(/%$/);
    }
    const bubble = wrap.querySelector(".coffee-bubble");
    expect(bubble.getAttribute("aria-live")).toBe("polite");
    expect(bubble.textContent).toBe("");
    expect(errors.map(String)).toEqual([]);
  });

  it("keeps the calendar link as the first link in main", () => {
    const { before } = setup();
    const { win, doc } = loadPage("contact.html", { before });
    expect(doc.querySelector("main a[href]").getAttribute("href")).toBe(win.SITE.calendar);
  });
});

/**
 * Give the layout coffee.js measures (jsdom has none): the stage width, the room in <main> and the
 * card's natural height. The scene needs 35 logical rows (heads to floor) per scale step.
 */
const layout = ({ stageW, room, card }) => (win) => {
  const E = win.Element.prototype, H = win.HTMLElement.prototype;
  const cw = Object.getOwnPropertyDescriptor(E, "clientWidth");
  const ch = Object.getOwnPropertyDescriptor(E, "clientHeight");
  const oh = Object.getOwnPropertyDescriptor(H, "offsetHeight");
  Object.defineProperty(H, "clientWidth", { configurable: true, get() { return this.classList && this.classList.contains("coffee-stage") ? stageW : cw.get.call(this); } });
  Object.defineProperty(H, "clientHeight", { configurable: true, get() { return this.tagName === "MAIN" ? room : ch.get.call(this); } });
  Object.defineProperty(H, "offsetHeight", { configurable: true, get() { return this.id === "contact" ? card : oh.get.call(this); } });
  const main = win.document.querySelector("main");
  main.style.padding = "0px"; // no stylesheet in jsdom: computed padding would be empty
};
const fitPage = (l) => {
  const { before } = setup();
  const size = layout(l);
  return loadPage("contact.html", { before: (win) => { before(win); size(win); } });
};

describe("coffee scene: size (largest whole pixel scale that fits under the card, 3x to 6x)", () => {
  it.each([
    [{ stageW: 1600, room: 1000, card: 300 }, "6"], // capped at 6x
    [{ stageW: 600, room: 500, card: 300 }, "5"], // height-bound: 200 / 35
    [{ stageW: 300, room: 900, card: 300 }, "3"], // width-bound: 300 / 88
    [{ stageW: 600, room: 405, card: 300 }, "3"], // exactly 3x of height
  ])("%o -> --s %s, shown, main.has-scene", (l, s) => {
    const { doc } = fitPage(l);
    const wrap = doc.querySelector(".coffee-scene");
    expect(wrap.hidden).toBe(false);
    expect(wrap.style.getPropertyValue("--s")).toBe(s);
    expect(doc.querySelector(".coffee-stage").style.getPropertyValue("--s")).toBe(s);
    expect(doc.querySelector("main").classList.contains("has-scene")).toBe(true);
  });

  it.each([
    [{ stageW: 263, room: 900, card: 300 }], // too narrow for 3x
    [{ stageW: 600, room: 404, card: 300 }], // too short for 3x under the card
    [{ stageW: 600, room: 250, card: 300 }], // card alone fills the page
  ])("%o -> hidden on first load, instead of scrolling or covering the card", (l) => {
    const { doc } = fitPage(l);
    expect(doc.querySelector(".coffee-scene").hidden).toBe(true);
    expect(doc.querySelector("main").classList.contains("has-scene")).toBe(false);
  });
});

describe("coffee scene: loop", () => {
  it("draws nothing until visible, animates while visible, pauses off-screen", async () => {
    const { rec, before } = setup();
    loadPage("contact.html", { before });
    await wait(250);
    expect(rec.draws, "no drawing before the observer reports").toBe(0);
    const io = rec.observers[0];
    expect(io && io.el && io.el.classList.contains("coffee-scene")).toBe(true);
    io.fire(true);
    expect(rec.draws, "first frame drawn on becoming visible").toBeGreaterThan(0);
    await wait(400);
    const running = rec.draws;
    expect(running, "keeps drawing at ~12 fps").toBeGreaterThan(2);
    io.fire(false);
    const paused = rec.draws;
    await wait(300);
    expect(rec.draws, "no frames while off-screen").toBe(paused);
    io.fire(true);
    await wait(300);
    expect(rec.draws, "resumes when visible again").toBeGreaterThan(paused);
  });

  it("pauses in a hidden tab and resumes when shown", async () => {
    const { rec, before } = setup();
    const { doc } = loadPage("contact.html", { before });
    rec.observers[0].fire(true);
    await wait(200);
    let hidden = true;
    Object.defineProperty(doc, "hidden", { get: () => hidden, configurable: true });
    doc.dispatchEvent(new doc.defaultView.Event("visibilitychange"));
    const n = rec.draws;
    await wait(300);
    expect(rec.draws).toBe(n);
    hidden = false;
    doc.dispatchEvent(new doc.defaultView.Event("visibilitychange"));
    await wait(300);
    expect(rec.draws).toBeGreaterThan(n);
  });

  it("without IntersectionObserver it still starts", async () => {
    const { rec, before } = setup({ io: false });
    const { errors } = loadPage("contact.html", { before });
    await wait(400);
    expect(rec.draws).toBeGreaterThan(1);
    expect(errors.map(String)).toEqual([]);
  });

  it("reduced motion: one still frame, no loop", async () => {
    const { rec, before } = setup();
    loadPage("contact.html", { before, media: REDUCE });
    rec.observers[0].fire(true);
    expect(rec.draws).toBe(1);
    await wait(400);
    expect(rec.draws).toBe(1);
  });
});

describe("coffee scene: Easter eggs", () => {
  it("statue egg shows 'So I did.' in the live bubble, then clears it", async () => {
    const { before } = setup();
    const { doc } = loadPage("contact.html", { before, media: REDUCE });
    const statue = [...doc.querySelectorAll(".coffee-egg")].find((b) => /statue/i.test(b.getAttribute("aria-label")));
    const bubble = doc.querySelector(".coffee-bubble");
    statue.click();
    expect(bubble.textContent).toBe("So I did.");
    await wait(2800);
    expect(bubble.textContent).toBe("");
  }, 10_000);

  it("three steam taps draw a heart (reduced motion redraws once per tap)", () => {
    const { rec, before } = setup();
    const { doc } = loadPage("contact.html", { before, media: REDUCE });
    const steam = [...doc.querySelectorAll(".coffee-egg")].find((b) => /steam/i.test(b.getAttribute("aria-label")));
    rec.observers[0].fire(true);
    for (let tap = 1; tap <= 3; tap++) {
      rec.fills = [];
      const n = rec.draws;
      steam.click();
      expect(rec.draws, `tap ${tap} redraws the still frame`).toBe(n + 1);
      if (tap < 3) expect(heartCells(rec.fills), `no heart after ${tap} tap(s) (a stray steam wisp is fine)`).toBeLessThanOrEqual(3);
      else expect(heartCells(rec.fills), "heart after the third tap").toBeGreaterThanOrEqual(12);
    }
  });
});
