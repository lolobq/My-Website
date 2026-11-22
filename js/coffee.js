/* Let's Get Coffee: the sculptor and her finished statue share a coffee at a garden table.
   Same pixel style, palette and sprite as the home scene (js/scene.js, js/sprites.js). This
   file only reads window.Sprites; it never touches the home scene.
   Easter eggs: tap the statue for a sip (and a "So I did."); tap the steam three times for a heart. */
(function () {
  const contact = document.getElementById("contact");
  const Sp = window.Sprites;
  if (!contact || !Sp) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const W = 96, H = 44, FRAME_MS = 1000 / 12; // pixel art: ~12 fps is plenty

  // ───────────── palette (copied from js/scene.js) ─────────────
  const G = {
    grass: "#76b657", grassDark: "#5a9645", grassLight: "#94cc6c",
    leaf: "#4f8f3a", leafDark: "#3a6f2d", leafLight: "#73b24f", trunkDark: "#6b4f33",
    pot: "#c4703f", potLight: "#dd8c57", potDark: "#97532d", citrus: "#f29a2e",
    gravel: "#ddd5c3", gravel2: "#d0c7b3", gravelLight: "#ebe5d8", gravelDark: "#b9af9a",
    box: "#3d7533", boxLight: "#5a9844", boxDark: "#2b5a26",
    travertine: "#e6dccb", travertineGap: "#c7bba6",
    frame: "#f3f1ea", frameShade: "#c9c0af", // white-painted garden iron
  };
  const STONE = Sp.STONE, STONE_LINE = "#3a332c", OUTLINE = Sp.OUTLINE;
  const TINT = "rgba(255,120,80,0.14)"; // the home scene's sunset tint (its default time of day)
  const CUP = { rim: "#fffaf0", body: "#f1ece2", shade: "#d9d2c4", coffee: "#6b4a2b" };
  // Same tone table as Sprites.statueMap, so the statue matches the finished one at 100% scroll.
  const STONE_TONE = { D: 1, d: 2, J: 2, j: 3, c: 0, S: 0, s: 1, W: 0, E: 4, R: 2, H: 1, h: 2, B: 3 };

  // ───────────── helpers (as in js/scene.js) ─────────────
  function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function disc(g, cx, cy, r, c) {
    g.fillStyle = c;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r + r * 0.8 - dy * dy));
      if (w >= 0) g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
    }
  }
  function line(g, x0, y0, x1, y1, fn) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, i = 0;
    const n = Math.max(dx, -dy) || 1;
    for (;;) {
      fn(x0, y0, i / n); i++;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function outlineCells(rows) {
    const out = [];
    const h = rows.length, w = rows[0].length;
    const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== ".";
    for (let y = -1; y <= h; y++)
      for (let x = -1; x <= w; x++)
        if (!filled(x, y) && (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))) out.push([x, y]);
    return out;
  }
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);

  // ───────────── seated sprite: Sprites.BODY head and torso, legs bent at the knee ─────────────
  const GW = 17;
  const LEGS = [
    "....JJJJJJJJJJJ..",
    "....jjjjjjjjJJj..",
    "............JJj..",
    "............JJj..",
    "............JJj..",
    "............JJj..",
    "............JJj..",
    "............BBBB.",
    "............BBBBB",
  ];
  const SEAT = Sp.BODY.slice(0, 21).map((r) => r.padEnd(GW, ".")).concat(LEGS); // 30 rows, faces right
  const SEAT_H = SEAT.length;
  const SEAT_OUT = outlineCells(SEAT);
  const MIRROR = SEAT.map((r) => r.split("").reverse().join("")); // the statue faces left
  const MIRROR_OUT = outlineCells(MIRROR);
  const statueTones = MIRROR.map((r, y) => r.split("").map((c, x) => {
    if (c === ".") return -1;
    const inside = (xx, yy) => xx >= 0 && yy >= 0 && xx < GW && yy < SEAT_H && MIRROR[yy][xx] !== ".";
    let t = STONE_TONE[c] ?? 1;
    if (!inside(x + 1, y) && t < 4) t++; // shadow on the right edge
    if (!inside(x, y - 1) && t > 0 && c !== "E") t--; // highlight on top edges
    return t;
  }));

  // ───────────── layout (logical pixels) ─────────────
  const FLOOR = 39;                  // bottom row of the shoes
  const OY = FLOOR - (SEAT_H - 1);   // top of both heads
  const LX = 27, RX = 52;            // sculptor (left) and statue (right) sprite origins
  const TABLE = { x0: 38, x1: 57, y: 28 };
  const L_MOUTH = { x: LX + 10, y: OY + 9 };
  const R_MOUTH = { x: RX + GW - 1 - 10, y: OY + 9 };
  const L_CUP = { x: 42, y: TABLE.y - 4 }; // 3x3 cup, saucer under it, handle toward the drinker
  const R_CUP = { x: 51, y: TABLE.y - 4 };
  const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
  const HEART_X = 44, HEART_Y = 14;

  // ───────────── DOM ─────────────
  const wrap = document.createElement("div");
  wrap.className = "coffee-scene";
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Pixel art: Lauren the sculptor and Lauren the statue having coffee together at a garden table.");
  const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
  const egg = (label, x, y, w, h) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "coffee-egg";
    b.setAttribute("aria-label", label);
    Object.assign(b.style, { left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H) });
    return b;
  };
  const statueBtn = egg("Give the statue a sip of coffee", RX + 1, OY - 1, GW - 1, SEAT_H + 1);
  const steamBtn = egg("Swirl the steam (try three times)", 40, 4, 16, 20);
  const bubble = document.createElement("p");
  bubble.className = "coffee-bubble";
  bubble.setAttribute("aria-live", "polite");
  Object.assign(bubble.style, { left: pct(RX + 9, W), top: pct(OY - 2, H) });
  wrap.append(canvas, steamBtn, statueBtn, bubble);
  contact.after(wrap);

  // ───────────── state ─────────────
  let ctx = null, base = null;
  let statueSipAt = -1e9, heartAt = -1e9, puffAt = -1e9, steamTaps = 0, bubbleTimer = 0, stillTimer = 0;
  const SIP_S = 1.6, HEART_S = 2.8, BUBBLE_MS = 2600;
  const clock = () => performance.now() / 1000;

  // ───────────── static layer: floor, garden, chair, plinth seat, table ─────────────
  function citrusPot(g, x, b) {
    rect(g, x - 4, b - 6, 8, 1, G.potLight);
    rect(g, x - 3, b - 5, 6, 4, G.pot);
    rect(g, x + 1, b - 5, 2, 4, G.potDark);
    rect(g, x - 2, b - 1, 4, 1, G.potDark);
    rect(g, x, b - 8, 1, 2, G.trunkDark);
    disc(g, x, b - 12, 4, G.leafDark);
    disc(g, x - 1, b - 13, 3, G.leaf);
    px(g, x - 2, b - 14, G.leafLight);
    for (let i = 0; i < 7; i++) px(g, x + Math.round((hash(x, i, 3) - 0.5) * 8), b - 12 + Math.round((hash(i, x, 4) - 0.5) * 8), G.citrus);
  }
  function topiary(g, x, b) {
    for (let i = 0; i < 7; i++) {
      const w = Math.floor((7 - i) / 2.5);
      rect(g, x - w, b - i - 1, w * 2 + 1, 1, i === 0 ? G.boxDark : G.box);
      px(g, x - w, b - i - 1, G.boxLight);
    }
  }
  function buildBase() {
    base = document.createElement("canvas");
    base.width = W; base.height = H;
    const g = base.getContext("2d");
    // a clipped box hedge behind the table, so steam and stone read against green
    for (let x = 5; x < W - 5; x++) {
      const end = Math.min(x - 5, W - 6 - x);
      const top = 9 + Math.round(1.6 * Math.sin(x * 0.42) + 1.2 * Math.sin(x * 0.17 + 1)) + (end < 4 ? 4 - end : 0);
      for (let y = top; y < 37; y++) {
        const n = hash(x, y, 21);
        let c = n < 0.22 ? G.boxDark : n > 0.9 ? G.boxLight : G.box;
        if (y === top) c = G.boxLight;
        else if (y === top + 1 && n < 0.5) c = G.boxLight;
        if (end === 0 || y >= 35) c = G.boxDark;
        px(g, x, y, c);
      }
    }
    // garden floor: a gravel terrace edged with grass, tapering at the ends
    for (let y = 37; y < H; y++) {
      const inset = Math.max(0, 40 - y) * 3 + 2;
      for (let x = inset; x < W - inset; x++) {
        const edge = x < inset + 2 || x >= W - inset - 2 || y === 37;
        const n = hash(x, y, 11);
        const c = edge ? (n < 0.3 ? G.grassDark : n > 0.8 ? G.grassLight : G.grass)
          : y === H - 1 ? G.gravelDark : n < 0.18 ? G.gravel2 : n > 0.9 ? G.gravelLight : n < 0.24 ? G.gravelDark : G.gravel;
        px(g, x, y, c);
      }
    }
    // soft shadow under the table and seats
    g.fillStyle = "rgba(58,51,44,0.18)";
    g.fillRect(26, 39, 44, 1); g.fillRect(30, 40, 36, 1);
    // garden on either side
    topiary(g, 9, 38); citrusPot(g, 17, 39);
    citrusPot(g, 79, 39); topiary(g, 87, 38);
    // the sculptor's iron bistro chair
    rect(g, 24, 19, 6, 3, OUTLINE); rect(g, 25, 21, 4, 20, OUTLINE);
    rect(g, 25, 32, 15, 3, OUTLINE); rect(g, 36, 34, 3, 7, OUTLINE);
    rect(g, 25, 20, 4, 1, G.frame);
    rect(g, 26, 21, 2, 19, G.frame); rect(g, 27, 22, 1, 18, G.frameShade);
    rect(g, 26, 33, 13, 1, G.frame);
    rect(g, 37, 34, 1, 6, G.frameShade);
    // the statue's seat: her plinth, in the statue's stone
    const bx0 = 55, bx1 = 66, by0 = 33;
    rect(g, bx0 - 1, by0 - 1, bx1 - bx0 + 2, FLOOR - by0 + 2, STONE_LINE);
    for (let y = by0; y <= FLOOR; y++)
      for (let x = bx0; x < bx1; x++) px(g, x, y, y === by0 ? STONE[0] : x >= bx1 - 2 ? STONE[3] : hash(x, y, 5) < 0.12 ? STONE[3] : STONE[2]);
    // café table: travertine top on a garden-iron pedestal
    rect(g, 46, TABLE.y + 2, 4, FLOOR - TABLE.y - 3, OUTLINE);
    rect(g, 44, FLOOR - 2, 8, 2, OUTLINE); rect(g, 43, FLOOR - 1, 10, 2, OUTLINE);
    rect(g, 47, TABLE.y + 2, 2, FLOOR - TABLE.y - 3, G.frame);
    rect(g, 48, TABLE.y + 2, 1, FLOOR - TABLE.y - 3, G.frameShade);
    rect(g, 45, FLOOR - 1, 6, 1, G.frame);
    rect(g, 44, FLOOR, 8, 1, G.frameShade);
  }
  function tableTop(g) {
    rect(g, TABLE.x0 - 1, TABLE.y - 1, TABLE.x1 - TABLE.x0 + 2, 4, STONE_LINE);
    rect(g, TABLE.x0, TABLE.y, TABLE.x1 - TABLE.x0, 1, G.travertine);
    rect(g, TABLE.x0, TABLE.y + 1, TABLE.x1 - TABLE.x0, 1, G.travertineGap);
  }

  // ───────────── actors ─────────────
  function drawSculptor(g, blink) {
    const pal = Sp.palette();
    g.fillStyle = OUTLINE;
    for (const [x, y] of SEAT_OUT) g.fillRect(LX + x, OY + y, 1, 1);
    for (let y = 0; y < SEAT_H; y++)
      for (let x = 0; x < GW; x++) {
        let c = SEAT[y][x];
        if (c === ".") continue;
        if (blink && (c === "W" || c === "E")) c = "s";
        px(g, LX + x, OY + y, pal[c]);
      }
  }
  function drawStatue(g, blink) {
    g.fillStyle = STONE_LINE;
    for (const [x, y] of MIRROR_OUT) g.fillRect(RX + x, OY + y, 1, 1);
    for (let y = 0; y < SEAT_H; y++)
      for (let x = 0; x < GW; x++) {
        let t = statueTones[y][x];
        if (t < 0) continue;
        if (blink && MIRROR[y][x] === "E") t = 1;
        px(g, RX + x, OY + y, STONE[t]);
      }
  }
  function saucer(g, c) {
    rect(g, c.x - 2, c.y + 3, 7, 1, STONE_LINE);
    rect(g, c.x - 1, c.y + 3, 5, 1, CUP.shade);
  }
  function cup(g, x, y, handle) {
    rect(g, x - 1, y - 1, 5, 5, OUTLINE);
    if (handle) { px(g, x + handle * 2 + 1, y, OUTLINE); px(g, x + handle * 2 + 1, y + 2, OUTLINE); px(g, x + handle * 2 + (handle > 0 ? 2 : 0), y + 1, OUTLINE); }
    rect(g, x, y, 3, 3, CUP.body);
    px(g, x, y, CUP.rim); px(g, x + 1, y, CUP.coffee); px(g, x + 2, y, CUP.rim);
    rect(g, x, y + 2, 3, 1, CUP.shade);
  }
  // A sip: 0 → resting on the saucer, 1 → at the lips. Returns where the cup is.
  function arm(g, sh, hand, upper, lower) {
    line(g, sh.x, sh.y, hand.x, hand.y, (x, y, t) => { const c = t < 0.35 ? upper : lower; px(g, x, y, c); px(g, x, y + 1, c); });
  }
  function drinker(g, side, k) {
    const left = side === "L";
    const rest = left ? L_CUP : R_CUP;
    const lip = left ? { x: L_MOUTH.x + 1, y: L_MOUTH.y - 1 } : { x: R_MOUTH.x - 3, y: R_MOUTH.y - 1 };
    const c = { x: lerp(rest.x, lip.x, k), y: lerp(rest.y, lip.y, k) };
    const hand = left ? { x: c.x - 2, y: c.y + 1 } : { x: c.x + 4, y: c.y + 1 };
    const sh = left ? { x: LX + 7, y: OY + 15 } : { x: RX + GW - 1 - 7, y: OY + 15 };
    const pal = Sp.palette();
    saucer(g, rest);
    cup(g, c.x, c.y, k > 0.5 ? 0 : left ? -1 : 1);
    if (left) arm(g, sh, hand, pal.D, pal.S);
    else arm(g, sh, hand, STONE[2], STONE[1]);
    return c;
  }
  const sipCurve = (p) => (p <= 0 || p >= 1 ? 0 : p < 0.25 ? p / 0.25 : p < 0.75 ? 1 : (1 - p) / 0.25);

  // Steam: little wisps rising and swaying above a cup. Static under reduced motion.
  const STILL_WISP = [[0, 0, 0.7], [1, -1, 0.6], [1, -2, 0.55], [0, -3, 0.45], [-1, -4, 0.4], [0, -5, 0.3], [1, -6, 0.22]];
  function steam(g, c, t, seed, big) {
    const bx = c.x + 1, by = c.y - 2;
    if (t === null) {
      for (const [dx, dy, a] of STILL_WISP) { g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(bx + dx, by + dy, 1, 1); }
      return;
    }
    const n = big ? 9 : 6, rise = big ? 12 : 9;
    for (let k = 0; k < n; k++) {
      const ph = (t * 0.45 + k / n + seed) % 1;
      const x = bx + Math.round(Math.sin(ph * 5 + t * 1.3 + seed * 9) * (1 + ph));
      const y = by - Math.floor(ph * rise);
      g.fillStyle = `rgba(255,255,255,${(0.95 * (1 - ph * 0.8)).toFixed(2)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  // Heart: the steam from both cups gathers into a heart, holds, then drifts apart.
  function heart(g, p) {
    const cells = [];
    HEART.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "#") cells.push([HEART_X + x, HEART_Y + y]); }));
    const gather = Math.min(1, p / 0.18), fade = p > 0.8 ? (1 - p) / 0.2 : 1;
    cells.forEach(([hx, hy], i) => {
      const from = i % 2 ? R_CUP : L_CUP;
      const x = lerp(from.x + 1, hx, gather), y = lerp(from.y - 2, hy, gather);
      const edge = !HEART[hy - HEART_Y + 1] || HEART[hy - HEART_Y][hx - HEART_X - 1] !== "#" || HEART[hy - HEART_Y][hx - HEART_X + 1] !== "#";
      g.fillStyle = `rgba(255,255,255,${((edge ? 0.75 : 0.95) * fade).toFixed(2)})`;
      g.fillRect(x, y, 1, 1);
    });
  }

  // ───────────── one frame ─────────────
  function draw(now) {
    const still = reduceMotion;
    const t = still ? null : now; // seconds; null = the still frame
    const g = ctx;
    g.clearRect(0, 0, W, H);
    g.drawImage(base, 0, 0);
    const blinkL = !still && (now * 1000) % 4300 < 130;
    const blinkR = !still && (now * 1000 + 2100) % 5100 < 130;
    // the far arm of each rests behind the body, on the table
    const pal = Sp.palette();
    arm(g, { x: LX + 9, y: OY + 14 }, { x: TABLE.x0 + 1, y: TABLE.y - 2 }, pal.d, pal.s);
    arm(g, { x: RX + GW - 1 - 9, y: OY + 14 }, { x: TABLE.x1 - 2, y: TABLE.y - 2 }, STONE[3], STONE[2]);
    drawSculptor(g, blinkL);
    drawStatue(g, blinkR);
    tableTop(g);

    // sips: hers on a slow loop, the statue's on its own loop or when tapped
    const egg = now - statueSipAt;
    const kL = still ? 0 : sipCurve(((now - 3) % 9) / SIP_S);
    const kR = egg >= 0 && egg < SIP_S ? (still ? 1 : sipCurve(egg / SIP_S)) : still ? 0 : sipCurve(((now - 7.5) % 11) / SIP_S);
    const cL = drinker(g, "L", kL);
    const cR = drinker(g, "R", kR);

    const h = now - heartAt;
    if (h >= 0 && h < HEART_S) heart(g, still ? 0.5 : h / HEART_S);
    else {
      const big = now - puffAt < 1.2;
      if (kL === 0) steam(g, cL, big && t !== null ? t * 1.6 : t, 0, big && t !== null);
      if (kR === 0) steam(g, cR, big && t !== null ? t * 1.6 : t, 0.37, big && t !== null);
      if (big && t === null) { steam(g, { x: cL.x + 1, y: cL.y - 1 }, null); steam(g, { x: cR.x - 1, y: cR.y - 1 }, null); }
    }

    // the home scene's sunset tint, over the drawn pixels only
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = TINT;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
  }

  // ───────────── loop: ~12 fps, only while on screen and the tab is visible ─────────────
  let onScreen = false, running = false, raf = 0, last = 0;
  function loop(ts) {
    raf = 0;
    if (!running) return;
    if (ts - last >= FRAME_MS) { last = ts; draw(ts / 1000); }
    raf = requestAnimationFrame(loop);
  }
  function update() {
    if (!ctx) return;
    const go = onScreen && !document.hidden && !reduceMotion;
    if (go && !running) { running = true; raf = requestAnimationFrame(loop); }
    else if (!go && running) { running = false; cancelAnimationFrame(raf); raf = 0; }
  }
  // Under reduced motion every change is a single redraw (and one more to put it back).
  function redrawStill(ms) {
    if (!ctx || !reduceMotion) return;
    draw(clock());
    clearTimeout(stillTimer);
    if (ms) stillTimer = setTimeout(() => draw(clock()), ms);
  }
  function init() {
    if (ctx) return true;
    ctx = canvas.getContext("2d");
    if (!ctx) return false;
    buildBase();
    draw(clock());
    return true;
  }

  // ───────────── Easter eggs ─────────────
  statueBtn.addEventListener("click", () => {
    if (!init()) return;
    statueSipAt = clock();
    bubble.textContent = "So I did.";
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.textContent = ""; }, BUBBLE_MS);
    redrawStill(BUBBLE_MS);
  });
  steamBtn.addEventListener("click", () => {
    if (!init()) return;
    steamTaps++;
    if (steamTaps >= 3) { steamTaps = 0; heartAt = clock(); redrawStill(HEART_S * 1000); }
    else { puffAt = clock(); redrawStill(1200); }
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen) init();
      update();
    }).observe(wrap);
  } else {
    requestAnimationFrame(() => { onScreen = true; if (init()) update(); });
  }
  document.addEventListener("visibilitychange", update);
})();
