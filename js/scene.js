/* The garden scene: pixel canvas, scroll-driven sculpting, story cards. */
(function () {
  const Sp = window.Sprites;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ───────────────────────── helpers ─────────────────────────
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5), ((s >>> 0) % 100000) / 100000);
  }
  function hex2rgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function disc(g, cx, cy, r, c) {
    g.fillStyle = c;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r + r * 0.8 - dy * dy));
      if (w >= 0) g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
    }
  }
  function ellipse(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.4) * (ry + 0.4)))));
      g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
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

  // ───────────────────────── time of day ─────────────────────────
  const TIMES = {
    morning: {
      label: "Morning", sky: ["#e9a7a0", "#f4c3aa", "#fbdcbc", "#fdeed3"],
      sun: { x: 0.18, y: 0.42, r: 7, c: "#fff1c9", glow: "#fde2b8" },
      cloud: "#fff7ef", cloudShade: "#f0cfc4", tint: null, star: false,
    },
    day: {
      label: "Day", sky: ["#5aaedb", "#78c3e6", "#a2d8ee", "#cfeef6"],
      sun: { x: 0.8, y: 0.2, r: 6, c: "#fffbe0", glow: "#d9f2f8" },
      cloud: "#ffffff", cloudShade: "#d3e9f2", tint: null, star: false,
    },
    sunset: {
      label: "Sunset", sky: ["#3f3570", "#8a4c86", "#df7a6c", "#f6ad79", "#fbd49a"],
      sun: { x: 0.74, y: 0.78, r: 10, c: "#ffe2a0", glow: "#f9bf86" },
      cloud: "#f7b9a0", cloudShade: "#b8698a", tint: "rgba(255,120,80,0.14)", star: false,
    },
    night: {
      label: "Night", sky: ["#0b1030", "#141c45", "#1f2a5f", "#2d3b78"],
      sun: { x: 0.78, y: 0.22, r: 5, c: "#eef0ff", glow: "#3a4890", moon: true },
      cloud: "#3a4682", cloudShade: "#28316a", tint: "rgba(16,24,72,0.52)", star: true,
    },
  };
  const ORDER = ["morning", "day", "sunset", "night"];
  function autoTime() {
    const h = new Date().getHours();
    if (h >= 5 && h < 9) return "morning";
    if (h >= 9 && h < 17) return "day";
    if (h >= 17 && h < 20) return "sunset";
    return "night";
  }
  let timeKey = autoTime();
  try { const saved = localStorage.getItem("garden-time"); if (TIMES[saved]) timeKey = saved; } catch (e) {}

  // ───────────────────────── canvas + layout ─────────────────────────
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const header = document.getElementById("site-header");
  const root = document.documentElement;

  let W, H, scale, cx, fy, hY;
  let L = {}; // layout of actors
  let skyLayer, groundLayer, actors, actx, clouds = [];

  const SLAB_W = 20, SLAB_H = 36;
  const statue = Sp.statueMap();
  let slabThresh = [], slabRaw = [], statueTone = [], rubble = [];

  function buildSlab() {
    const r = rng(7);
    slabThresh = []; slabRaw = []; statueTone = [];
    const ox = 3, oy = 1;
    for (let y = 0; y < SLAB_H; y++) {
      slabThresh.push([]); slabRaw.push([]); statueTone.push([]);
      for (let x = 0; x < SLAB_W; x++) {
        const ty = y / (SLAB_H - 4);
        slabThresh[y].push(0.03 + 0.6 * ty + 0.26 * r());
        const n = hash(x, y, 3);
        let c = n < 0.15 ? "#a9a193" : n > 0.9 ? "#d3ccbf" : "#bdb5a6";
        if (x === 0 || x === 1) c = "#d3ccbf";
        if (x >= SLAB_W - 2) c = "#958d7f";
        if (y === 0) c = "#e2dccf";
        if ((x + y * 3) % 23 === 0 && y > 2) c = "#958d7f"; // little cracks
        slabRaw[y].push(c);
        const sx = x - ox, sy = y - oy;
        const t = sx >= 0 && sy >= 0 && sx < statue.w && sy < statue.h ? statue.tones[sy][sx] : -1;
        statueTone[y].push(t);
      }
    }
    rubble = [];
    for (let i = 0; i < 46; i++) {
      rubble.push({
        dx: Math.round((r() - 0.5) * (SLAB_W + 18)),
        dy: Math.round(r() * 3) - 1,
        c: Sp.STONE[1 + Math.floor(r() * 3)],
        big: r() < 0.25,
        t: (i / 46) * 0.95 + 0.02,
      });
    }
  }
  buildSlab();

  function layout() {
    const headerH = header.getBoundingClientRect().height;
    const sceneH = window.innerHeight - headerH;
    scale = clamp(Math.floor(sceneH / 150), 2, 6);
    W = Math.ceil(window.innerWidth / scale);
    H = Math.ceil(sceneH / scale);
    canvas.width = W; canvas.height = H;
    canvas.style.width = W * scale + "px";
    canvas.style.height = H * scale + "px";
    canvas.style.top = headerH + "px";

    cx = Math.floor(W / 2);
    fy = Math.floor(H / 2) + 18; // feet line, so the figure is centered
    hY = fy - 30; // horizon

    L.sx = cx - 17; L.sy = fy - Sp.H;
    L.slabX = L.sx + 15; L.slabY = fy - SLAB_H;

    const figTop = headerH + (fy - SLAB_H) * scale;
    const figBottom = headerH + (fy + 2) * scale;
    root.style.setProperty("--header-h", headerH + "px");
    root.style.setProperty("--fig-top", figTop + "px");
    root.style.setProperty("--fig-bottom", figBottom + "px");

    actors = document.createElement("canvas");
    actors.width = W; actors.height = H;
    actx = actors.getContext("2d");
    buildBackground();
  }

  // ───────────────────────── background ─────────────────────────
  function gradientBands(cols, steps) {
    const out = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1) * (cols.length - 1);
      const k = Math.min(cols.length - 2, Math.floor(t));
      out.push(mix(cols[k], cols[k + 1], t - k));
    }
    return out;
  }

  function buildSky(T) {
    skyLayer = document.createElement("canvas");
    skyLayer.width = W; skyLayer.height = H;
    const g = skyLayer.getContext("2d");
    const bands = gradientBands(T.sky, 7);
    const top = hY + 4;
    for (let y = 0; y < top; y++) {
      const f = (y / top) * (bands.length - 1);
      const k = Math.min(bands.length - 2, Math.floor(f));
      const frac = f - k;
      for (let x = 0; x < W; x++) px(g, x, y, frac > bayer(x, y) ? bands[k + 1] : bands[k]);
    }
    if (T.star) {
      for (let y = 0; y < top - 8; y++)
        for (let x = 0; x < W; x++) {
          const h = hash(x, y, 11);
          if (h < 0.004) px(g, x, y, "#ffffff");
          else if (h < 0.01) px(g, x, y, "#8f9ad6");
        }
    }
    const s = T.sun;
    const sx = Math.round(W * s.x), sy = Math.round(hY * s.y);
    disc(g, sx, sy, s.r + 3, s.glow);
    disc(g, sx, sy, s.r, s.c);
    if (s.moon) disc(g, sx + 3, sy - 2, s.r - 1, T.sky[0]);

    // clouds
    const r = rng(42 + ORDER.indexOf(timeKey));
    clouds = [];
    const n = Math.max(3, Math.round(W / 90));
    for (let i = 0; i < n; i++) {
      const cw = 16 + Math.floor(r() * 18), ch = 9;
      const c = document.createElement("canvas");
      c.width = cw + 4; c.height = ch + 2;
      const cg = c.getContext("2d");
      const puffs = 3 + Math.floor(r() * 3);
      for (let p = 0; p < puffs; p++) {
        const pr = 2 + Math.floor(r() * 3);
        disc(cg, 2 + pr + Math.floor(r() * (cw - pr * 2)), ch - pr - 1, pr, T.cloudShade);
      }
      for (let p = 0; p < puffs; p++) {
        const pr = 2 + Math.floor(r() * 3);
        disc(cg, 2 + pr + Math.floor(r() * (cw - pr * 2)), ch - pr - 2, pr, T.cloud);
      }
      clouds.push({ img: c, x: r() * W, y: 4 + Math.floor(r() * Math.max(4, hY * 0.45)), v: 0.012 + r() * 0.02 });
    }
  }

  // ground palette
  const G = {
    grass: "#76b657", grassFar: "#6aa64f", grassDark: "#5a9645", grassLight: "#94cc6c",
    leaf: "#4f8f3a", leafDark: "#3a6f2d", leafLight: "#73b24f", leafDeep: "#2c5626",
    trunk: "#8a6a46", trunkDark: "#6b4f33",
    stone: "#cbbfa8", stoneGap: "#a39780", stoneEdge: "#8d826c",
    water: "#4f9cc2", waterDeep: "#3b7fa6", waterEdge: "#2f6788", shimmer: "#cdeef8",
    rim: "#9a968c", rimLight: "#c4c0b4", rimDark: "#6f6b62",
    glass: "#bfe3da", glassLight: "#e3f5ef", frame: "#f3f1ea", frameDark: "#55705f",
    treeFar: "#8fb48a", treeFarDark: "#79a074",
    hedge: "#4c8a3b", hedgeLight: "#66a54b", hedgeDark: "#376b2c",
    pot: "#c4703f", potLight: "#dd8c57", potDark: "#97532d",
    wood: "#9c6b3f", woodDark: "#6e4a2b",
  };
  const FLOWERS = ["#f28bb3", "#b591e3", "#f6d55c", "#ffffff", "#f57d6a"];

  function buildGround(T) {
    groundLayer = document.createElement("canvas");
    groundLayer.width = W; groundLayer.height = H;
    const g = groundLayer.getContext("2d");
    const r = rng(1234);

    // far tree line
    for (let x = -10; x < W + 10; x += 5 + Math.floor(r() * 6)) {
      const rad = 5 + Math.floor(r() * 7);
      disc(g, x, hY - 4 - Math.floor(r() * 5), rad, G.treeFarDark);
    }
    for (let x = -10; x < W + 10; x += 6 + Math.floor(r() * 7)) {
      const rad = 4 + Math.floor(r() * 5);
      disc(g, x, hY - 3 - Math.floor(r() * 4), rad, G.treeFar);
    }

    // glasshouse (botanical conservatory) behind, to the right
    drawGlasshouse(g, cx + Math.max(46, Math.round(W * 0.2)), hY + 1);
    // a smaller one far left on wide screens
    if (W > 300) drawGlasshouse(g, cx - Math.round(W * 0.33), hY + 1, 0.6);

    // grass
    for (let y = hY - 1; y < H; y++) {
      const t = clamp((y - hY) / (H - hY), 0, 1);
      for (let x = 0; x < W; x++) {
        let c = t + (bayer(x, y) - 0.5) * 0.3 < 0.18 ? G.grassFar : G.grass;
        const h = hash(x, y, 5);
        if (h < 0.06) c = G.grassDark;
        else if (h < 0.09) c = G.grassLight;
        else if (h < 0.0965 && y > hY + 3) c = FLOWERS[Math.floor(hash(x, y, 9) * FLOWERS.length)];
        px(g, x, y, c);
      }
    }

    // hedge row with flowers along the horizon
    for (let x = -4; x < W + 4; x += 3) {
      const rr = 3 + Math.floor(hash(x, 1, 2) * 2);
      disc(g, x, hY - 1, rr, G.hedgeDark);
    }
    for (let x = -4; x < W + 4; x += 3) {
      const rr = 2 + Math.floor(hash(x, 2, 2) * 2);
      disc(g, x, hY - 2, rr, G.hedge);
      px(g, x - 1, hY - 2 - rr + 1, G.hedgeLight);
      if (hash(x, 3, 2) < 0.35) px(g, x, hY - 3, FLOWERS[Math.floor(hash(x, 4, 2) * 5)]);
    }

    // palms framing the scene
    palm(g, Math.min(cx - 78, Math.round(W * 0.12)), hY + 10, 30, -1);
    palm(g, Math.max(cx + 84, Math.round(W * 0.86)), hY + 12, 34, 1);

    // patio of flagstones where she works
    patio(g, L.slabX + 2, fy + 1, 36, 6);

    // pond next to her
    pond(g, cx - 50, fy + 2, 22, 7);

    // ferns and plants close by
    fern(g, cx - 74, fy - 4, 9);
    fern(g, L.slabX + SLAB_W + 14, fy - 2, 8);
    pottedPlant(g, L.slabX + SLAB_W + 5, fy);
    toolbox(g, L.sx - 6, fy);

    // foreground: flower beds, bushes and tall blooms
    const rows = [fy + 14, fy + 30, fy + 48, fy + 70];
    rows.forEach((ry, ri) => {
      if (ry > H + 4) return;
      for (let x = 4 + ri * 9; x < W; x += 16 + Math.floor(r() * 20)) {
        if (ri === 0 && Math.abs(x - (cx - 50)) < 28) continue;
        const kind = r();
        const y = ry + Math.floor(r() * 8);
        if (kind < 0.6) bush(g, x, y, 4 + ri + Math.floor(r() * 3), FLOWERS[Math.floor(r() * 5)]);
        else if (kind < 0.85) tallFlowers(g, x, y, FLOWERS[Math.floor(r() * 5)], 6 + ri * 2);
        else fern(g, x, y, 6 + ri);
      }
    });
    // big leaves in the bottom corners
    bigLeaf(g, 0, H + 2, 22, -1);
    bigLeaf(g, W, H + 2, 24, 1);

    if (T.tint) {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = T.tint;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "source-over";
    }
  }

  function drawGlasshouse(g, gx, by, k = 1) {
    const ww = Math.round(30 * k), wh = Math.round(12 * k), rh = Math.round(7 * k);
    const tw = Math.round(11 * k), th = Math.round(12 * k), dr = tw;
    const inside = (x, y) => {
      const dx = x - gx;
      if (Math.abs(dx) <= ww && y <= by && y >= by - wh) return true;
      if (Math.abs(dx) <= ww && y < by - wh) {
        const e = (dx * dx) / (ww * ww) + Math.pow((by - wh - y) / rh, 2);
        if (e <= 1) return true;
      }
      if (Math.abs(dx) <= tw && y <= by && y >= by - wh - th) return true;
      const dy = by - wh - th - y;
      if (dy > 0 && dx * dx + dy * dy <= dr * dr + dr * 0.6) return true;
      return false;
    };
    const top = by - wh - th - dr - 4;
    for (let y = top; y <= by; y++)
      for (let x = gx - ww - 1; x <= gx + ww + 1; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y - 1);
        let c;
        if (edge) c = G.frameDark;
        else if (y >= by - 1) c = "#b9ad97";
        else if ((x - gx) % 4 === 0 || y === by - wh || y === by - wh - th) c = G.frame;
        else c = (x + y) % 9 === 0 || (x + y + 1) % 9 === 0 ? G.glassLight : G.glass;
        px(g, x, y, c);
      }
    // finial + door
    rect(g, gx, top + 1, 1, 3, G.frameDark);
    rect(g, gx - 2, by - 6, 5, 6, "#5d7a6a");
    px(g, gx, by - 7, "#5d7a6a");
  }

  function palm(g, x, base, h, dir) {
    let tx = x, ty = base;
    for (let i = 0; i < h; i++) {
      const xx = Math.round(x + dir * Math.pow(i / h, 2) * 5);
      rect(g, xx, base - i, 2, 1, i % 3 === 0 ? G.trunkDark : G.trunk);
      tx = xx; ty = base - i;
    }
    const fronds = [[-1, -0.3], [-0.8, 0.5], [-0.3, -0.9], [0.3, -0.9], [0.8, 0.5], [1, -0.3], [0, -1]];
    for (const [fx, fyv] of fronds) {
      const len = 13;
      for (let i = 0; i <= len; i++) {
        const t = i / len;
        const x1 = Math.round(tx + 1 + fx * i);
        const y1 = Math.round(ty + fyv * i * 0.6 + t * t * 7);
        px(g, x1, y1, G.leafDark);
        if (i > 2 && i % 2 === 0) {
          px(g, x1, y1 + 1, G.leaf);
          px(g, x1, y1 + 2, G.leafDark);
        }
        px(g, x1, y1 - 1, i < len - 2 ? G.leafLight : G.leaf);
      }
    }
    disc(g, tx + 1, ty, 2, G.trunkDark);
  }

  function patio(g, x0, y0, rx, ry) {
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.4) * (ry + 0.4)))));
      for (let dx = -w; dx <= w; dx++) {
        const x = x0 + dx, y = y0 + dy;
        const row = Math.floor((dy + ry) / 3);
        let c = (dx + rx + row * 4) % 8 === 0 || (dy + ry) % 3 === 0 ? G.stoneGap : G.stone;
        if (Math.abs(dx) === w) c = G.stoneEdge;
        else if (hash(x, y, 8) < 0.07) c = G.stoneGap;
        px(g, x, y, c);
      }
    }
  }

  function pond(g, x0, y0, rx, ry) {
    L.pond = { x: x0, y: y0, rx, ry };
    ellipse(g, x0, y0, rx + 2, ry + 2, G.rimDark);
    for (let a = 0; a < Math.PI * 2; a += 0.17) {
      const x = Math.round(x0 + Math.cos(a) * (rx + 1)), y = Math.round(y0 + Math.sin(a) * (ry + 1));
      rect(g, x - 1, y - 1, 3, 2, Math.sin(a) < 0 ? G.rim : G.rimLight);
      px(g, x - 1, y - 1, G.rimLight);
    }
    ellipse(g, x0, y0, rx, ry, G.water);
    ellipse(g, x0 + 2, y0 + 1, Math.round(rx * 0.55), Math.round(ry * 0.5), G.waterDeep);
    rect(g, x0 - rx + 4, y0 - ry, rx * 2 - 8, 1, G.waterEdge);
    // lily pads
    const pads = [[-12, 1], [7, 3], [13, -2], [-4, -3]];
    pads.forEach(([dx, dy], i) => {
      ellipse(g, x0 + dx, y0 + dy, 2, 1, G.leaf);
      px(g, x0 + dx + 1, y0 + dy - 1, G.water);
      px(g, x0 + dx - 1, y0 + dy - 1, G.leafLight);
      if (i % 2 === 0) { px(g, x0 + dx, y0 + dy - 1, "#f6a7c4"); px(g, x0 + dx, y0 + dy - 2, "#fbd0e0"); }
    });
    // reeds at the back of the pond
    const reeds = [[-rx + 2, 13], [-rx + 4, 9], [-rx + 6, 15], [-rx + 8, 11], [rx - 4, 10], [rx - 2, 14]];
    for (const [dx, h] of reeds) {
      const x = x0 + dx, yb = y0 - ry + 1;
      rect(g, x, yb - h, 1, h, G.leafDark);
      px(g, x + 1, yb - h + 3, G.leaf);
      if (h > 10) rect(g, x, yb - h - 1, 1, 3, "#7a4b2a");
    }
  }

  function fern(g, x, y, s) {
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (0.12 + (k / 6) * 0.76);
      const len = s + (k === 3 ? 2 : 0);
      for (let i = 0; i <= len; i++) {
        const t = i / len;
        const fx = Math.round(x - Math.cos(a) * i * 1.2);
        const fyy = Math.round(y - Math.sin(a) * i + t * t * 5);
        px(g, fx, fyy, G.leafDark);
        if (i % 2 === 1 && i < len) { px(g, fx, fyy - 1, G.leafLight); px(g, fx + 1, fyy, G.leaf); }
      }
    }
  }

  function bush(g, x, y, s, flower) {
    disc(g, x, y, s, G.leafDeep);
    disc(g, x - s + 2, y + 1, s - 2, G.leafDark);
    disc(g, x + s - 2, y + 1, s - 2, G.leafDark);
    disc(g, x - 1, y - 1, s - 1, G.leaf);
    for (let i = 0; i < s * 3; i++) {
      const fx = x + Math.round((hash(x, i, 1) - 0.5) * s * 2);
      const fyy = y + Math.round((hash(i, x, 2) - 0.6) * s * 1.6);
      if (hash(i, i, x) < 0.5) px(g, fx, fyy, G.leafLight);
      else { px(g, fx, fyy, flower); }
    }
  }

  function tallFlowers(g, x, y, c, h) {
    for (let k = -2; k <= 2; k++) {
      const hh = h - Math.abs(k) * 2 + Math.floor(hash(x, k, 4) * 3);
      const sx = x + k * 2;
      rect(g, sx, y - hh, 1, hh, G.leafDark);
      px(g, sx + (k < 0 ? -1 : 1), y - Math.floor(hh / 2), G.leaf);
      rect(g, sx - 1, y - hh - 1, 3, 1, c);
      px(g, sx, y - hh - 2, c);
      px(g, sx, y - hh - 1, "#f6d55c");
    }
  }

  function bigLeaf(g, x, y, s, dir) {
    for (let k = 0; k < 4; k++) {
      const a = (-Math.PI / 2) + dir * (-0.9 + k * 0.45);
      const len = s - k * 2;
      for (let i = 0; i < len; i++) {
        const w = Math.round(Math.sin((i / len) * Math.PI) * 4);
        const lx = Math.round(x + Math.cos(a) * i * -dir * dir + (dir < 0 ? Math.abs(Math.cos(a)) * i : -Math.abs(Math.cos(a)) * i));
        const ly = Math.round(y + Math.sin(a) * i);
        for (let j = -w; j <= w; j++) px(g, lx + j, ly, j === 0 ? G.leafLight : Math.abs(j) === w ? G.leafDeep : G.leafDark);
      }
    }
  }

  function pottedPlant(g, x, base) {
    rect(g, x, base - 6, 7, 6, G.pot);
    rect(g, x - 1, base - 7, 9, 2, G.potLight);
    rect(g, x + 5, base - 5, 2, 5, G.potDark);
    rect(g, x - 1, base - 7, 9, 1, G.potDark);
    fern(g, x + 3, base - 8, 6);
  }

  function toolbox(g, x, base) {
    rect(g, x - 3, base - 4, 7, 4, G.wood);
    rect(g, x - 3, base - 4, 7, 1, G.woodDark);
    rect(g, x - 3, base - 1, 7, 1, G.woodDark);
    rect(g, x - 1, base - 6, 3, 1, G.woodDark);
    px(g, x - 1, base - 5, G.woodDark); px(g, x + 1, base - 5, G.woodDark);
    px(g, x + 3, base - 6, "#b8bcc4"); px(g, x + 3, base - 5, "#8a8f99"); // a spare chisel
  }

  function buildBackground() {
    const T = TIMES[timeKey];
    buildSky(T);
    buildGround(T);
  }

  // ───────────────────────── scroll state ─────────────────────────
  let progress = 0, shownProgress = 0, lastScrollAt = -1e9, lastStrikeFrame = 0;
  const chips = [];
  const butterflies = [];
  let nextButterfly = performance.now() + 1200;
  const fireflies = Array.from({ length: 14 }, (_, i) => ({ s: i * 97.3, x: 0, y: 0 }));

  function readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    if (p !== progress) lastScrollAt = performance.now();
    progress = p;
    updateStory(p);
  }

  // ───────────────────────── actors ─────────────────────────
  function drawSlab(g, p) {
    const filled = [];
    for (let y = 0; y < SLAB_H; y++) {
      filled.push([]);
      for (let x = 0; x < SLAB_W; x++) {
        let c = null;
        const plinth = y >= SLAB_H - 3 && x >= 1 && x < SLAB_W - 1;
        const st = statueTone[y][x];
        const t = slabThresh[y][x];
        if (plinth) c = p > 0.9 ? (y === SLAB_H - 3 ? Sp.STONE[0] : x > SLAB_W - 4 ? Sp.STONE[3] : Sp.STONE[2]) : slabRaw[y][x];
        else if (st >= 0) c = p >= t + 0.06 ? Sp.STONE[st] : slabRaw[y][x];
        else if (p < t) c = slabRaw[y][x];
        filled[y].push(c);
      }
    }
    const isF = (x, y) => x >= 0 && y >= 0 && x < SLAB_W && y < SLAB_H && filled[y][x];
    g.fillStyle = "#3a332c";
    for (let y = -1; y <= SLAB_H; y++)
      for (let x = -1; x <= SLAB_W; x++)
        if (!isF(x, y) && (isF(x + 1, y) || isF(x - 1, y) || isF(x, y + 1) || isF(x, y - 1)))
          g.fillRect(L.slabX + x, L.slabY + y, 1, 1);
    for (let y = 0; y < SLAB_H; y++)
      for (let x = 0; x < SLAB_W; x++)
        if (filled[y][x]) { g.fillStyle = filled[y][x]; g.fillRect(L.slabX + x, L.slabY + y, 1, 1); }

    // where the chisel is working now: highest remaining rough pixel near the frontier
    let target = null;
    for (let y = 0; y < SLAB_H - 3 && !target; y++)
      for (let x = 0; x < SLAB_W; x++) {
        const t = slabThresh[y][x] + (statueTone[y][x] >= 0 ? 0.06 : 0);
        if (p < t && t - p < 0.12) { target = y; break; }
      }
    return target ?? Math.round((SLAB_H - 4) * clamp(p, 0, 1));
  }

  function drawRubble(g, p) {
    for (const rb of rubble) {
      if (p < rb.t) continue;
      const x = L.slabX + SLAB_W / 2 + rb.dx, y = fy + rb.dy;
      if (x > L.sx && x < L.sx + 12) continue; // not on her feet
      px(g, x, y, rb.c);
      if (rb.big) { px(g, x + 1, y, rb.c); px(g, x, y - 1, Sp.STONE[0]); }
    }
  }

  function arm(g, sx, sy, hx, hy, shirt, skin) {
    line(g, sx, sy, hx, hy, (x, y, t) => {
      const c = t < 0.5 ? shirt : skin;
      px(g, x, y, c); px(g, x, y + 1, c);
    });
  }

  function drawSculptor(g, now, p, targetRow) {
    const pal = Sp.palette();
    const sx = L.sx, sy = L.sy;
    const done = p > 0.975;
    const swinging = !done && now - lastScrollAt < 260 && !reduceMotion;
    const frame = swinging ? Math.floor(now / 130) % 2 : 1;

    // hand positions
    let hy = clamp(L.slabY + targetRow, sy + 8, sy + 23);
    let ch = { x: L.slabX - 4, y: hy }; // chisel hand
    let mh = frame === 0 ? { x: ch.x - 5, y: ch.y - 5 } : { x: ch.x - 3, y: ch.y - 1 };
    if (done) { ch = { x: sx + 11, y: sy + 21 }; mh = { x: sx + 8, y: sy + 22 }; }

    // strike → chips
    if (swinging && frame === 1 && lastStrikeFrame === 0) {
      for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++)
        chips.push({ x: ch.x + 4, y: ch.y, vx: 0.1 + Math.random() * 0.6, vy: -0.4 - Math.random() * 0.9,
          c: Sp.STONE[1 + Math.floor(Math.random() * 3)], life: 120 });
    }
    lastStrikeFrame = swinging ? frame : 1;

    // far arm (to the chisel) behind the body
    arm(g, sx + 9, sy + 14, ch.x, ch.y, pal.t, pal.s);
    const blink = Math.floor(now / 100) % 45 === 0;
    Sp.drawBody(g, sx, sy, { blink });
    // chisel
    if (!done) {
      rect(g, ch.x + 1, ch.y, 3, 1, "#b8bcc4");
      px(g, ch.x + 1, ch.y, "#6b4a2b");
    } else {
      rect(g, ch.x, ch.y + 1, 1, 3, "#b8bcc4");
    }
    // near arm (mallet)
    arm(g, sx + 7, sy + 15, mh.x, mh.y, pal.T, pal.S);
    // mallet
    if (!done) {
      line(g, mh.x, mh.y + 2, mh.x, mh.y - 1, (x, y) => px(g, x, y, G.woodDark));
      rect(g, mh.x - 1, mh.y - 3, 4, 2, G.wood);
      rect(g, mh.x - 1, mh.y - 2, 4, 1, G.woodDark);
    } else {
      rect(g, mh.x, mh.y + 1, 1, 3, G.woodDark);
      rect(g, mh.x - 1, mh.y + 4, 3, 2, G.wood);
    }
  }

  function updateChips() {
    for (let i = chips.length - 1; i >= 0; i--) {
      const c = chips[i];
      c.vy += 0.07; c.x += c.vx; c.y += c.vy; c.life--;
      if (c.y >= fy + 1) { c.y = fy + 1; c.vx *= 0.5; c.vy = 0; }
      if (c.life <= 0) chips.splice(i, 1);
    }
  }

  function updateButterflies(now) {
    if (now > nextButterfly && butterflies.length < 2 && !reduceMotion) {
      const fromLeft = Math.random() < 0.5;
      butterflies.push({
        x: fromLeft ? -6 : W + 6, dir: fromLeft ? 1 : -1,
        base: hY - 20 + Math.random() * (fy - hY + 26), amp: 3 + Math.random() * 6,
        speed: 0.18 + Math.random() * 0.22, ph: Math.random() * 6,
        c: ["#f08a24", "#6cb6ff", "#f6d55c", "#f6f2ff", "#e88fd0"][Math.floor(Math.random() * 5)],
      });
      nextButterfly = now + 3500 + Math.random() * 6000;
    }
    for (let i = butterflies.length - 1; i >= 0; i--) {
      const b = butterflies[i];
      b.x += b.speed * b.dir; b.ph += 0.03;
      if (b.x < -10 || b.x > W + 10) butterflies.splice(i, 1);
    }
  }

  function drawButterfly(g, b, now) {
    const fr = Sp.BUTTERFLY[Math.floor(now / 140 + b.ph * 3) % 2];
    const x0 = Math.round(b.x) - 2, y0 = Math.round(b.base + Math.sin(b.ph) * b.amp + Math.sin(b.ph * 3.1) * 1.5);
    fr.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === "A") px(g, x0 + x, y0 + y, b.c);
        else if (ch === "B") px(g, x0 + x, y0 + y, "#2b2233");
      })
    );
  }

  // ───────────────────────── render loop ─────────────────────────
  function frame(now) {
    // ease the drawn progress toward the scroll position for smoothness
    shownProgress += (progress - shownProgress) * (reduceMotion ? 1 : 0.25);
    if (Math.abs(progress - shownProgress) < 0.0005) shownProgress = progress;
    const p = shownProgress;
    const T = TIMES[timeKey];

    ctx.drawImage(skyLayer, 0, 0);
    for (const c of clouds) {
      if (!reduceMotion) c.x += c.v;
      if (c.x > W + 4) c.x = -c.img.width;
      ctx.drawImage(c.img, Math.round(c.x), c.y);
    }
    ctx.drawImage(groundLayer, 0, 0);

    // water shimmer
    if (L.pond) {
      const { x, y, rx, ry } = L.pond;
      for (let k = 0; k < 7; k++) {
        const sx = Math.round(x - rx + 3 + ((k * 13 + now * 0.004 * (1 + (k % 3))) % (rx * 2 - 6)));
        const sy = y - ry + 2 + ((k * 5) % (ry * 2 - 3));
        const nx = (sx - x) / rx, ny = (sy - y) / ry;
        if (nx * nx + ny * ny < 0.75) {
          ctx.fillStyle = timeKey === "night" ? "#8e9fd8" : G.shimmer;
          ctx.fillRect(sx, sy, 2 + (k % 2), 1);
        }
      }
    }

    // actors on their own layer so night/sunset can tint them
    actx.clearRect(0, 0, W, H);
    drawRubble(actx, p);
    const targetRow = drawSlab(actx, p);
    drawSculptor(actx, now, p, targetRow);
    updateChips();
    for (const c of chips) px(actx, Math.round(c.x), Math.round(c.y), c.c);
    updateButterflies(now);
    if (timeKey !== "night") for (const b of butterflies) drawButterfly(actx, b, now);
    if (T.tint) {
      actx.globalCompositeOperation = "source-atop";
      actx.fillStyle = T.tint;
      actx.fillRect(0, 0, W, H);
      actx.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(actors, 0, 0);

    // fireflies at night
    if (timeKey === "night") {
      for (const f of fireflies) {
        const t = now / 1000;
        const x = Math.round((f.s * 7.1 + Math.sin(t * 0.4 + f.s) * 18 + t * 2) % W);
        const y = Math.round(hY - 6 + ((f.s * 3.7) % (fy - hY + 20)) + Math.sin(t * 0.9 + f.s) * 4);
        const on = Math.sin(t * 2 + f.s) > 0.1;
        if (!on) continue;
        ctx.fillStyle = "rgba(230,255,140,0.25)";
        ctx.fillRect(x - 1, y - 1, 3, 3);
        px(ctx, x, y, "#f2ffb0");
      }
    }
    requestAnimationFrame(frame);
  }

  // ───────────────────────── story cards ─────────────────────────
  const stage = document.getElementById("story");
  const quote = document.getElementById("quote");
  const hint = document.getElementById("scroll-hint");
  const spacer = document.getElementById("scroll-space");
  const CARDS = window.CARDS || [];
  const N = CARDS.length;
  const S = window.SITE;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const mailto = `mailto:${S.email}` + (S.emailSubject ? `?subject=${encodeURIComponent(S.emailSubject)}` : "");

  spacer.style.height = `${N * 130 + 30}vh`;

  const cardEls = CARDS.map((c, i) => {
    const el = document.createElement("article");
    el.className = `card pixel-box ${i % 2 === 0 ? "zone-top" : "zone-bottom"}${c.cta ? " card-cta" : ""}`;
    el.setAttribute("aria-hidden", "true");
    const imgs = (c.images || [])
      .map((im) =>
        im.src
          ? `<img src="${esc(im.src)}" alt="${esc(im.alt || "")}" loading="lazy">`
          : `<div class="ph" role="img" aria-label="${esc(im.alt || "Photo placeholder")}"><span>${esc(im.alt || "Photo")}</span></div>`
      )
      .join("");
    const links = (c.links || [])
      .map((l) => `<a class="btn btn-link" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} →</a>`)
      .join("");
    el.innerHTML = `
      ${c.kicker ? `<p class="kicker">${esc(c.kicker)}</p>` : ""}
      <h2>${esc(c.title)}</h2>
      ${(c.body || []).map((b) => `<p>${esc(b)}</p>`).join("")}
      ${imgs ? `<div class="gallery">${imgs}</div>` : ""}
      ${links ? `<div class="links">${links}</div>` : ""}
      ${c.cta ? `<a class="btn btn-big" href="${mailto}">Contact me</a>` : ""}`;
    stage.appendChild(el);
    return el;
  });

  function updateStory(p) {
    const started = window.scrollY > 6;
    quote.classList.toggle("is-gone", started);
    hint.classList.toggle("is-gone", started);
    cardEls.forEach((el, i) => {
      const q = p * N - i; // 0..1 inside this card's segment
      let x; // in vw
      if (q <= 0) x = 110;
      else if (q < 0.28) x = 110 * (1 - ease(q / 0.28));
      else if (q < 0.82 || i === N - 1) x = 0;
      else if (q < 1) x = -110 * ease((q - 0.82) / 0.18);
      else x = -110;
      el.style.transform = `translate(calc(-50% + ${x.toFixed(2)}vw), -50%)`;
      const visible = Math.abs(x) < 60;
      el.setAttribute("aria-hidden", visible ? "false" : "true");
      el.classList.toggle("is-active", visible);
      el.style.visibility = Math.abs(x) >= 109 ? "hidden" : "visible";
    });
  }

  hint.addEventListener("click", () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: (max * 0.32) / N, behavior: reduceMotion ? "auto" : "smooth" });
  });

  // time of day toggle
  const tbtn = document.getElementById("time-toggle");
  function setTimeLabel() { tbtn.querySelector("span").textContent = TIMES[timeKey].label; }
  tbtn.addEventListener("click", () => {
    timeKey = ORDER[(ORDER.indexOf(timeKey) + 1) % ORDER.length];
    try { localStorage.setItem("garden-time", timeKey); } catch (e) {}
    document.body.dataset.time = timeKey;
    setTimeLabel();
    buildBackground();
  });
  document.body.dataset.time = timeKey;
  setTimeLabel();

  // quote typewriter
  function typeQuote() {
    const textEl = quote.querySelector(".q-text");
    const full = textEl.dataset.text;
    if (reduceMotion) { textEl.textContent = full; quote.classList.add("is-typed"); return; }
    let i = 0;
    const step = () => {
      i++;
      textEl.textContent = full.slice(0, i);
      if (i < full.length) setTimeout(step, full[i - 1] === "," ? 220 : 34);
      else quote.classList.add("is-typed");
    };
    setTimeout(step, 500);
  }

  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", () => { layout(); readScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); readScroll(); });
  layout();
  readScroll();
  typeQuote();
  requestAnimationFrame(frame);

  // for screenshots / debugging
  window.__garden = { setTime: (k) => { timeKey = k; document.body.dataset.time = k; setTimeLabel(); buildBackground(); } };
})();
