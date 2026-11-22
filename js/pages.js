/* Reflections (blog) and Resume pages. */
(function () {
  const h = document.getElementById("site-header");
  if (h) document.documentElement.style.setProperty("--header-h", h.getBoundingClientRect().bottom + "px");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const blog = document.getElementById("reflections");
  if (blog) {
    const TAGS = window.TAGS || [];
    const tagLabel = (id) => (TAGS.find((t) => t.id === id) || { label: id }).label;
    const valid = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
    const posts = (window.POSTS || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const intro = window.REFLECTIONS || window.WRITING || {};
    const params = new URLSearchParams(location.search);
    const post = posts.find((p) => p.slug === params.get("post"));
    const time = (p) => (valid(p.date) ? `<time datetime="${esc(p.date)}">${fmt(p.date)}</time>` : "");

    // Inline formatting in a paragraph: **bold**, *italic*, [text](url). Everything else is escaped.
    const safeHref = (u) => (/^(https?:|mailto:|\/|#|[\w.-]+(\/|\.html|$))/i.test(u) && !/^\s*javascript:/i.test(u) ? u : "");
    const inline = (s) =>
      esc(s)
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
          const href = safeHref(url.replace(/&amp;/g, "&"));
          if (!href) return text;
          const ext = /^https?:/i.test(href);
          return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
        })
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    const block = (b) => {
      if (typeof b === "string") return `<p>${inline(b)}</p>`;
      if (!b || typeof b !== "object") return "";
      if (b.h) return `<h2>${esc(b.h)}</h2>`;
      if (b.quote) return `<figure class="post-quote"><blockquote><p>${inline(b.quote)}</p></blockquote>${b.cite ? `<figcaption>${esc(b.cite)}</figcaption>` : ""}</figure>`;
      if (b.img) return `<figure class="post-img"><img src="${esc(b.img)}" alt="${esc(b.alt || "")}" ${(window.Media && window.Media.attrs(b.img)) || ""} loading="lazy" decoding="async"></figure>`;
      if (Array.isArray(b.list)) return `<ul>${b.list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`;
      return "";
    };
    // Reading time from every word in the body, at ~220 words a minute.
    const words = (p) => (p.body || []).map((b) => (typeof b === "string" ? b : [b.h, b.quote, ...(b.list || [])].filter(Boolean).join(" "))).join(" ").split(/\s+/).filter(Boolean).length;
    const minutes = (p) => `${Math.max(1, Math.round(words(p) / 220))} min read`;
    const chips = (p) => ((p.tags || []).length
      ? `<ul class="tag-chips" aria-label="Tags">${p.tags.map((t) => `<li><a class="tag-chip" href="reflections.html?tag=${encodeURIComponent(t)}">${esc(tagLabel(t))}</a></li>`).join("")}</ul>`
      : "");
    const setMeta = (text) => {
      if (!text) return;
      ["meta[name='description']", "meta[property='og:description']"].forEach((sel) => { const m = document.querySelector(sel); if (m) m.setAttribute("content", text); });
    };

    if (post) {
      document.title = `${post.title} · Reflections`;
      const og = document.querySelector("meta[property='og:title']");
      if (og) og.setAttribute("content", document.title);
      setMeta(post.excerpt);
      const r = post.reading;
      blog.innerHTML = `<article class="post">
        <a class="btn back" href="reflections.html">← All reflections</a>
        <header class="post-head">
          <p class="post-meta">${[time(post), minutes(post)].filter(Boolean).join(" · ")}</p>
          <h1>${esc(post.title)}</h1>
          ${chips(post)}
        </header>
        ${r && r.title ? `<aside class="reading-card" aria-label="What I've been reading">
            <p class="reading-title">${r.href ? `<a href="${esc(safeHref(r.href) || "#")}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}</p>
            ${r.author ? `<p class="reading-author">${esc(r.author)}</p>` : ""}
          </aside>` : ""}
        <div class="post-body">${(post.body || []).map(block).join("")}</div>
      </article>`;
    } else {
      // List with a tag filter. ?tag=philosophy deep links to a filtered view; back/forward work.
      blog.innerHTML = `<h1>${esc(intro.title || "Reflections")}</h1>
        ${intro.lede ? `<p class="lede">${esc(intro.lede)}</p>` : ""}
        <div class="tag-filter" role="group" aria-label="Filter by tag">
          ${[{ id: "", label: "All" }, ...TAGS].map((t) => `<button class="btn" type="button" data-tag="${esc(t.id)}" aria-pressed="false">${esc(t.label)}</button>`).join("")}
        </div>
        <div class="post-results" aria-live="polite"></div>`;
      const results = blog.querySelector(".post-results");
      const btns = [...blog.querySelectorAll(".tag-filter .btn")];
      const current = () => { const t = new URLSearchParams(location.search).get("tag") || ""; return TAGS.some((x) => x.id === t) ? t : ""; };
      const render = () => {
        const tag = current();
        btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === tag)));
        const shown = tag ? posts.filter((p) => (p.tags || []).includes(tag)) : posts;
        results.innerHTML = shown.length
          ? `<ul class="post-list">${shown.map((p) => `<li><article class="post-card">
              <p class="post-meta">${[time(p), minutes(p)].filter(Boolean).join(" · ")}</p>
              <h2><a class="post-link" href="reflections.html?post=${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h2>
              ${p.excerpt ? `<p class="post-excerpt">${esc(p.excerpt)}</p>` : ""}
              ${chips(p)}
            </article></li>`).join("")}</ul>`
          : `<p class="post-empty">${tag ? `Nothing tagged ${esc(tagLabel(tag))} yet. <a href="reflections.html">See all reflections</a>.` : "No reflections yet. Check back soon."}</p>`;
      };
      btns.forEach((b) => b.addEventListener("click", () => {
        if (b.dataset.tag === current()) return;
        const url = b.dataset.tag ? `reflections.html?tag=${encodeURIComponent(b.dataset.tag)}` : "reflections.html";
        history.pushState(null, "", url);
        render();
      }));
      window.addEventListener("popstate", render);
      render();
    }
  }

  const resume = document.getElementById("resume");
  if (resume) {
    const S = window.SITE || {};
    const R = window.RESUME || {};
    const pdf = S.resumePdf || "assets/resume.pdf";
    const exp = R.experience || [];
    const edu = R.education || [];
    const skills = R.skills || [];
    const honors = R.honors || [];
    const pubs = R.publications || [];
    const ul = (arr) => (arr && arr.length ? `<ul>${arr.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "");
    const meta = (...parts) => parts.filter(Boolean).map(esc).join(" · ");
    const pubLink = (p) => (p.href ? `<a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.citation)}</a>` : esc(p.citation));
    // Parts shared by the text version and the phone slabs (one source, two layouts).
    const roleBody = (e) => `<h3>${esc(e.role)}, ${esc(e.org)}</h3>
          <p class="doc-meta">${meta(e.location, e.dates)}</p>
          ${ul(e.bullets)}`;
    const eduBody = (e) => `<h3>${esc(e.school)}</h3><p class="doc-meta">${meta(e.degree, e.dates, e.note)}</p>`;
    const skillsList = () => `<ul class="doc-skills">${skills.map((s) => `<li><strong>${esc(s.label)}:</strong> ${(s.items || []).map(esc).join(", ")}</li>`).join("")}</ul>`;
    const pubsList = () => `<ul>${pubs.map((p) => `<li>${pubLink(p)}</li>`).join("")}</ul>`;

    // Document view: a plain, selectable, printable resume.
    const contactBits = [
      S.email && `<a href="mailto:${esc(S.email)}">${esc(S.email)}</a>`,
      S.linkedin && `<a href="${esc(S.linkedin)}">${esc(S.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>`,
      S.github && `<a href="${esc(S.github)}">${esc(S.github.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>`,
    ].filter(Boolean);
    const documentView = `
      <header class="doc-head">
        <p class="doc-name">${esc(S.name || "")}</p>
        ${S.tagline ? `<p class="doc-tagline">${esc(S.tagline)}</p>` : ""}
        ${contactBits.length ? `<p class="doc-contact">${contactBits.join(" · ")}</p>` : ""}
      </header>
      ${R.summary ? `<section><h2>Summary</h2><p>${esc(R.summary)}</p></section>` : ""}
      ${exp.length ? `<section><h2>Experience</h2>${exp.map((e) => `<article class="doc-role">
          ${roleBody(e)}
        </article>`).join("")}</section>` : ""}
      ${edu.length ? `<section><h2>Education</h2>${edu.map((e) => `<article class="doc-role">
          ${eduBody(e)}
        </article>`).join("")}</section>` : ""}
      ${skills.length ? `<section><h2>Skills</h2>${skillsList()}</section>` : ""}
      ${honors.length ? `<section><h2>Honors</h2>${ul(honors)}</section>` : ""}
      ${pubs.length ? `<section><h2>Publications</h2>${pubsList()}</section>` : ""}`;

    // Phones, touch and no-viewer browsers: the highlights as stone slabs under the PDF buttons.
    // No summary and no honors here (the PDF has both).
    const slabGroup = (id, title, body) => `<section class="resume-group" aria-labelledby="rs-${id}">
          <h2 class="resume-kicker stone" id="rs-${id}">${esc(title)}</h2>${body}
        </section>`;
    const slabs = [
      exp.length && slabGroup("experience", "Experience", exp.map((e) => `<article class="resume-slab doc-role stone">${roleBody(e)}</article>`).join("")),
      skills.length && slabGroup("skills", "Skills", `<div class="resume-slab stone">${skillsList()}</div>`),
      pubs.length && slabGroup("publications", "Publications", `<div class="resume-slab stone">${pubsList()}</div>`),
      edu.length && slabGroup("education", "Education", edu.map((e) => `<article class="resume-slab doc-role stone">${eduBody(e)}</article>`).join("")),
    ].filter(Boolean).join("");

    // The PDF is the page: just the garden and the embedded PDF in a stone frame (the viewer's
    // own toolbar downloads and prints). Phones, touch and no-viewer browsers get no frame
    // (Android shows nothing, iOS only page 1); there one stone slab holds Open / Download,
    // with the highlights below it as slabs (the text version is then aria-hidden).
    // The heading and the HTML text version are visually hidden, for screen readers, search
    // and print (links in it skip the Tab order, so keyboard focus never goes invisible).
    resume.innerHTML = `
      <section id="document" class="resume-pdf" aria-labelledby="resume-heading">
        <h1 id="resume-heading" class="sr-only" tabindex="-1">${esc(R.title || "Resume")}</h1>
        <div class="resume-frame-slot stone"></div>
        <div class="resume-fallback stone">
          <a class="btn btn-link" href="${esc(pdf)}" target="_blank" rel="noopener">Open my resume (PDF)</a>
          <a class="btn" href="${esc(pdf)}" download>Download PDF</a>
        </div>
        ${slabs ? `<div class="resume-slabs">${slabs}</div>` : ""}
      </section>
      <article class="resume-doc sr-only" id="resume-document" aria-label="${esc(R.title || "Resume")}, text version">${documentView}</article>`;
    resume.querySelectorAll("#resume-document a").forEach((a) => a.setAttribute("tabindex", "-1"));

    const slot = resume.querySelector(".resume-frame-slot");
    const textDoc = resume.querySelector("#resume-document");
    const wide = matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
    const canEmbed = () => navigator.pdfViewerEnabled !== false && wide.matches;
    const placeFrame = () => {
      const has = !!slot.firstChild;
      if (canEmbed() && !has) {
        slot.innerHTML = `<iframe class="resume-frame" src="${esc(pdf)}#view=FitH&navpanes=0" title="${esc([S.name, R.title || "Resume"].filter(Boolean).join(", "))} (PDF)"></iframe>`;
      } else if (!canEmbed() && has) slot.textContent = "";
      document.body.classList.toggle("has-pdf-frame", !!slot.firstChild);
      // With the slabs on screen, screen readers get them, not the sr-only text version too.
      // (Printing shows the text version alone, so it is exposed again while printing.)
      if (slot.firstChild || !slabs || printing.matches) textDoc.removeAttribute("aria-hidden");
      else textDoc.setAttribute("aria-hidden", "true");
    };
    const printing = matchMedia("print");
    placeFrame();
    if (wide.addEventListener) wide.addEventListener("change", placeFrame);
    if (printing.addEventListener) printing.addEventListener("change", placeFrame);

    // Skip to work lands on #document: focus the heading at the top of the PDF region.
    const heading = resume.querySelector("#resume-heading");
    // (Again after load: the browser's own jump to #document would otherwise reset focus.)
    const focusHeading = () => { if (location.hash === "#document") heading.focus(); };
    focusHeading();
    window.addEventListener("load", () => setTimeout(focusHeading, 0));
    window.addEventListener("hashchange", focusHeading);
    // Printing prints the text version (css/pages.css un-hides it for print).
  }
})();

/* About, Projects, Speaking and Contact pages. */
(function () {
  const S = window.SITE;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const paras = (arr) => (arr || []).map((p) => `<p>${esc(p)}</p>`).join("");
  const links = (arr) => (arr && arr.length ? `<div class="links">${arr.map((l) => `<a class="btn" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} →</a>`).join("")}</div>` : "");
  const mailto = `mailto:${S.email}` + (S.emailSubject ? `?subject=${encodeURIComponent(S.emailSubject)}` : "");

  const about = document.getElementById("about");
  if (about) {
    const A = window.ABOUT || {};
    about.innerHTML = `<div class="about-head">${S.photo ? `<img class="about-photo" src="${esc(S.photo)}" alt="Photo of ${esc(S.name)}" ${(window.Media && window.Media.attrs(S.photo)) || ""}>` : ""}
      <div><h1>${esc(A.title || "About")}</h1><p class="lede">${esc(S.tagline)}</p></div></div>${paras(A.body)}`;
  }

  const M = window.Media || { attrs: () => "" };
  const lede = (t) => (t ? `<p class="lede">${esc(t)}</p>` : "");
  const img = (im, cls) =>
    im && im.src ? `<img class="${cls}" src="${esc(im.src)}" alt="${esc(im.alt || "")}" ${M.attrs(im.src)} loading="lazy" decoding="async">` : "";

  // Projects: stone tiles over the garden. Each tile opens its full case study or workbench
  // details in a dialog (#id deep links; back closes it). Anything not tiled is "Also exploring".
  const projects = document.getElementById("projects");
  if (projects) {
    const P = window.PROJECTS && !Array.isArray(window.PROJECTS) ? window.PROJECTS : {};
    const cases = P.caseStudies || [];
    const bench = P.workbench || [];
    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // Which projects get a tile, in order. Keys are a case study's id or a slug of the title.
    const TILE_KEYS = ["smartcity", "capstone", "stealth-ai-startup", "job-search-agent-mcp-server"];
    // The picture at the top of each tile. Swap in a real screenshot by changing src (and alt,
    // if it says something the title doesn't); width/height keep the box from shifting.
    // The startup stays generic (disclosure rule): no screenshot, logo or name.
    const TILE_ART = {
      smartcity: { src: "assets/img/projects/smartcity.svg", alt: "", w: 160, h: 120 },
      capstone: { src: "assets/img/projects/capstone.svg", alt: "", w: 160, h: 120 },
      "stealth-ai-startup": { src: "assets/img/projects/stealth-ai-startup.svg", alt: "", w: 160, h: 120 },
      "job-search-agent-mcp-server": { src: "assets/img/projects/job-search-agent-mcp-server.svg", alt: "", w: 160, h: 120 },
    };

    const items = [
      ...cases.map((c) => ({ kind: "case", key: c.id || slug(c.title), title: c.title, meta: c.tag, line: c.summary, data: c })),
      ...bench.map((w) => ({ kind: "bench", key: slug(w.title), title: w.title, meta: w.status, line: w.description, data: w })),
    ];
    const byKey = new Map(items.map((it) => [it.key, it]));
    const tiles = TILE_KEYS.map((k) => byKey.get(k)).filter(Boolean);
    const extras = items.filter((it) => !TILE_KEYS.includes(it.key));

    // media: null → placeholder; { type: "image" | "video", src, alt, poster } → the demo.
    const media = (w) => {
      const m = w.media;
      if (m && m.src && m.type === "video")
        return `<video class="wb-video" controls preload="none" playsinline${m.poster ? ` poster="${esc(m.poster)}"` : ""}${m.alt ? ` aria-label="${esc(m.alt)}"` : ""}><source src="${esc(m.src)}"></video>`;
      if (m && m.src) return img(m, "wb-img");
      return `<div class="wb-placeholder stone" role="img" aria-label="${esc([w.title, w.status].filter(Boolean).join(": "))}">
          <svg class="wb-glyph" viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges"><path fill="#3a332c" d="M3 1h6v1h1v10H2V2h1z"/><path fill="#bdb5a6" d="M3 2h6v9H3z"/><path fill="#e2dccf" d="M3 2h6v1H3z"/><path fill="#d3ccbf" d="M3 3h1v8H3z"/><path fill="#958d7f" d="M8 3h1v8H8z"/><path fill="#a9a193" d="M5 5h1v1H5zM6 8h1v1H6z"/></svg>
          ${w.status ? `<span class="wb-status">${esc(w.status)}</span>` : ""}
        </div>`;
    };
    // Typewriter text, like the home quote: full text in its final layout from first paint
    // (the untyped rest is only visibility:hidden), with a stable copy for screen readers.
    const tw = (s) => `<span class="tw" aria-hidden="true"><span class="tw-typed"></span><span class="tw-rest">${esc(s)}</span></span><span class="sr-only">${esc(s)}</span>`;

    const panel = (it) => {
      const c = it.data;
      const body = it.kind === "case"
        ? `${c.tag ? `<p class="item-meta">${esc(c.tag)}</p>` : ""}
          <h2 id="${esc(it.key)}-h">${esc(c.title)}</h2>
          ${c.summary ? `<p class="case-summary">${esc(c.summary)}</p>` : ""}
          ${(c.sections || []).map((s) => `<section>${s.heading ? `<h3>${esc(s.heading)}</h3>` : ""}${paras(s.body)}</section>`).join("")}
          ${links(c.links)}`
        : `${c.status ? `<p class="item-meta">${esc(c.status)}</p>` : ""}
          <h2 id="${esc(it.key)}-h">${esc(c.title)}</h2>
          <div class="wb-media">${media(c)}</div>
          ${c.description ? `<p>${esc(c.description)}</p>` : ""}
          ${links(c.links)}`;
      return `<dialog class="project-panel" id="${esc(it.key)}" aria-labelledby="${esc(it.key)}-h">
          <div class="panel-inner stone">
            <button class="btn stone panel-close" type="button" data-close>Close</button>
            <article class="case-study${it.kind === "bench" ? " wb-detail" : ""}">${body}</article>
          </div>
        </dialog>`;
    };

    const art = (key) => {
      const a = TILE_ART[key];
      return a && a.src
        ? `<div class="tile-art"><img src="${esc(a.src)}" alt="${esc(a.alt || "")}" width="${a.w || 160}" height="${a.h || 120}" decoding="async"></div>`
        : "";
    };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = tiles.length;
    const label = (i) => `Project ${i + 1} of ${n}: ${tiles[i].title}`;
    // One row: a queue of tiles, one centred, its neighbours peeking. The page itself never scrolls.
    projects.innerHTML = `<div class="projects-head stone"><h1>${esc(P.title || "Projects")}</h1>${lede(P.lede)}</div>
      <section class="queue" role="region" aria-roledescription="carousel" aria-label="Projects">
        <div class="queue-viewport">
          <ul class="tiles${reduce ? "" : " is-entering"}" style="--at:0">${tiles.map((it, i) => `<li class="tile stone${i === 0 ? " is-current" : ""}" style="--i:${i}"${i === 0 ? "" : " inert"}>
              ${art(it.key)}
              <h2 class="tile-title"><a class="tile-link" href="#${esc(it.key)}" data-panel="${esc(it.key)}" aria-haspopup="dialog">${tw(it.title)}</a></h2>
              ${it.meta ? `<p class="tile-meta">${tw(it.meta)}</p>` : ""}
              ${it.line ? `<p class="tile-line">${tw(it.line)}</p>` : ""}
              <span class="tile-more" aria-hidden="true">→</span>
            </li>`).join("")}</ul>
        </div>
        ${n > 1 ? `<div class="queue-controls stone">
          <button class="queue-arrow" type="button" data-step="-1" aria-label="Previous project" aria-disabled="true">←</button>
          <div class="queue-dots">${tiles.map((it, i) => `<button class="queue-dot" type="button" data-to="${i}" aria-label="${esc(label(i))}"${i === 0 ? ' aria-current="true"' : ""}></button>`).join("")}</div>
          <span class="queue-count" aria-hidden="true">1 of ${n}</span>
          <button class="queue-arrow" type="button" data-step="1" aria-label="Next project">→</button>
        </div>` : ""}
        <p class="queue-status sr-only" aria-live="polite" aria-atomic="true"></p>
      </section>
      ${extras.length ? `<p class="also stone">Also exploring: ${extras.map((it) => `<a href="#${esc(it.key)}" data-panel="${esc(it.key)}" aria-haspopup="dialog">${esc(it.title)}</a>`).join(", ")}</p>` : ""}
      ${items.map(panel).join("")}`;

    // Entrance: slabs rise in sequence while their text types in (~2s). Any scroll, key or tap
    // finishes it at once; reduced motion shows everything immediately.
    const list = projects.querySelector(".tiles");
    const runs = [...list.children].map((el) => [...el.querySelectorAll(".tw")].map((t) => ({
      el: t, typed: t.querySelector(".tw-typed"), rest: t.querySelector(".tw-rest"), full: t.querySelector(".tw-rest").textContent, n: -1,
    })));
    const STAGGER = 280, TYPE_DELAY = 160, TYPE_MS = 850;
    const EVENTS = ["scroll", "keydown", "pointerdown", "wheel", "touchstart"];
    let raf = 0, start = 0, done = false;
    const show = (r, n) => {
      if (r.n === n) return;
      r.n = n;
      r.typed.textContent = r.full.slice(0, n);
      r.rest.textContent = r.full.slice(n);
      r.el.classList.toggle("is-typing", n > 0 && n < r.full.length);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      runs.flat().forEach((r) => show(r, r.full.length));
      list.classList.remove("is-entering");
      EVENTS.forEach((ev) => window.removeEventListener(ev, finish));
    };
    if (reduce) finish();
    else {
      runs.flat().forEach((r) => show(r, 0));
      EVENTS.forEach((ev) => window.addEventListener(ev, finish, { passive: true }));
      const tick = (now) => {
        if (done) return;
        if (!start) start = now;
        let all = true;
        runs.forEach((tile, i) => {
          const total = tile.reduce((s, r) => s + r.full.length, 0);
          const t = Math.max(0, Math.min(1, (now - start - i * STAGGER - TYPE_DELAY) / TYPE_MS));
          let left = Math.round(t * total);
          tile.forEach((r) => { const n = Math.min(left, r.full.length); show(r, n); left -= n; });
          if (t < 1) all = false;
        });
        if (all) finish();
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // The queue: wheel / trackpad (either axis), swipe, arrow keys, the arrow buttons and the dots
    // all move it one tile. Scroll down or swipe left = next. Only the centred tile is interactive;
    // the peeking neighbours are inert (clicking one brings it to the centre).
    const queue = projects.querySelector(".queue");
    const tileEls = [...list.children];
    const status = queue.querySelector(".queue-status");
    const count = queue.querySelector(".queue-count");
    const dots = [...queue.querySelectorAll(".queue-dot")];
    const arrows = [...queue.querySelectorAll(".queue-arrow")];
    let at = 0;
    const anyOpen = () => !!projects.querySelector("dialog[open]");
    // Sideways phones are too short for one screen, so the page scrolls there (css/pages.css):
    // then vertical gestures belong to the page and only horizontal ones move the queue.
    const pageScrolls = () => document.documentElement.scrollHeight > innerHeight + 1;
    const go = (i, opts = {}) => {
      i = Math.max(0, Math.min(n - 1, i));
      if (i === at) return false;
      finish();
      const hadFocus = tileEls[at].contains(document.activeElement);
      at = i;
      if (opts.instant) list.classList.add("no-slide");
      list.style.setProperty("--at", String(i));
      tileEls.forEach((el, k) => {
        el.classList.toggle("is-current", k === i);
        if (k === i) el.removeAttribute("inert");
        else el.setAttribute("inert", "");
      });
      dots.forEach((d, k) => (k === i ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
      arrows.forEach((b) => {
        const off = (+b.dataset.step < 0 && i === 0) || (+b.dataset.step > 0 && i === n - 1);
        if (off) b.setAttribute("aria-disabled", "true");
        else b.removeAttribute("aria-disabled");
      });
      if (count) count.textContent = `${i + 1} of ${n}`;
      if (!opts.quiet) status.textContent = label(i);
      if (hadFocus) tileEls[i].querySelector(".tile-link").focus({ preventScroll: true });
      if (opts.instant) { void list.offsetWidth; list.classList.remove("no-slide"); }
      return true;
    };
    const step = (d) => go(at + d);
    // The viewport clips with overflow:hidden, which can still be scrolled (find-in-page, focus):
    // keep it at 0 so the transform alone decides what's centred.
    const vp = queue.querySelector(".queue-viewport");
    vp.addEventListener("scroll", () => { if (vp.scrollLeft || vp.scrollTop) vp.scrollLeft = vp.scrollTop = 0; });
    queue.addEventListener("click", (e) => {
      const b = e.target.closest(".queue-arrow, .queue-dot");
      if (b) {
        if (b.getAttribute("aria-disabled") !== "true") (b.dataset.to != null ? go(+b.dataset.to) : step(+b.dataset.step));
        return;
      }
      // Inert neighbours aren't hit targets, so a click on one lands here: use its side.
      if (e.target.closest(".tile.is-current")) return;
      const r = tileEls[at].getBoundingClientRect();
      if (e.clientX < r.left) step(-1);
      else if (e.clientX > r.right) step(1);
    });
    queue.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const d = { ArrowLeft: -1, PageUp: -1, ArrowRight: 1, PageDown: 1 }[e.key];
      const to = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
      if (!d && to === null) return;
      e.preventDefault();
      if (to !== null) go(to);
      else step(d);
    });
    // One wheel gesture or trackpad flick = one tile: step once when the gesture's travel passes
    // a threshold, then ignore the rest of it (including momentum) until it goes quiet.
    let acc = 0, locked = false, quietT = 0, lastAbs = 0, lockedAt = 0;
    window.addEventListener("wheel", (e) => {
      if (e.ctrlKey || anyOpen()) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      const dx = e.deltaX * unit, dy = e.deltaY * unit;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : pageScrolls() ? 0 : dy;
      const abs = Math.abs(d);
      clearTimeout(quietT);
      quietT = setTimeout(() => { locked = false; acc = 0; lastAbs = 0; }, 200);
      // A fresh flick during momentum shows up as a sharp rise in speed.
      if (locked && abs > 30 && abs > lastAbs * 2.5 && performance.now() - lockedAt > 350) { locked = false; acc = 0; }
      lastAbs = abs;
      if (locked) return;
      if (acc && Math.sign(acc) !== Math.sign(d)) acc = 0;
      acc += d;
      if (Math.abs(acc) >= 40) {
        step(acc > 0 ? 1 : -1);
        locked = true; lockedAt = performance.now(); acc = 0;
      }
    }, { passive: true });
    // Touch: a swipe on either axis (the page doesn't scroll, so vertical swipes move the queue too).
    let t0 = null;
    queue.addEventListener("touchstart", (e) => {
      t0 = e.touches.length === 1 && !(window.visualViewport && visualViewport.scale > 1.01) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    queue.addEventListener("touchend", (e) => {
      if (!t0 || anyOpen()) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - t0.x, dy = t.clientY - t0.y;
      t0 = null;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : pageScrolls() ? 0 : dy;
      if (Math.abs(d) >= 40) step(d < 0 ? 1 : -1);
    }, { passive: true });

    // Panels: native modal dialogs (focus moves in, Esc closes, the page behind is inert).
    let opener = null;
    const dialogs = [...projects.querySelectorAll("dialog.project-panel")];
    const keyOf = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ""; } };
    const openPanel = (key) => {
      const d = byKey.has(key) ? dialogs.find((x) => x.id === key) : null;
      if (!d) return false;
      const ti = tiles.findIndex((t) => t.key === key);
      if (ti >= 0) go(ti, { instant: true, quiet: true }); // the queue follows #hash deep links
      dialogs.forEach((o) => { if (o !== d && o.open) o.close(); });
      if (!d.open) { d.showModal(); d.scrollTop = 0; }
      return true;
    };
    projects.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-panel]");
      if (!a) return;
      e.preventDefault();
      finish();
      opener = a;
      const key = a.dataset.panel;
      if (keyOf() !== key) history.pushState({ panel: key }, "", `#${key}`);
      openPanel(key);
    });
    dialogs.forEach((d) => {
      d.querySelector("[data-close]").addEventListener("click", () => d.close());
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); }); // backdrop
      d.addEventListener("close", () => {
        if (keyOf() === d.id) {
          if (history.state && history.state.panel === d.id) history.back();
          else history.replaceState(null, "", location.pathname + location.search);
        }
        const back = opener || projects.querySelector(`a[data-panel="${d.id}"]`);
        opener = null;
        if (back) back.focus();
      });
    });
    const sync = () => {
      if (openPanel(keyOf())) { finish(); return; }
      dialogs.forEach((d) => { if (d.open) d.close(); });
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    if (location.hash) sync();
  }

  // Speaking: talks with photos, topics, and the YouTube channel.
  const speaking = document.getElementById("speaking");
  if (speaking) {
    const SP = window.SPEAKING || {};
    const talks = SP.talks || window.TALKS || [];
    const topics = SP.topics || [];
    const yt = SP.youtube;
    const ytHref = (yt && yt.href) || S.youtube;
    speaking.innerHTML = `<h1>${esc(SP.title || "Speaking")}</h1>${lede(SP.lede)}
      <ul class="item-list talk-list">${talks.map((t) => `<li class="talk${t.image && t.image.src ? " has-image" : ""}">
          ${t.image && t.image.src ? `<div class="talk-media">${img(t.image, "talk-img")}</div>` : ""}
          <div class="talk-body">
            ${t.event || t.date ? `<p class="item-meta">${esc([t.event, t.date].filter(Boolean).join(" · "))}</p>` : ""}
            <h2>${esc(t.title)}</h2>
            ${paras(t.description)}
            ${links(t.links)}
          </div>
        </li>`).join("")}</ul>
      ${topics.length ? `<section class="topics" aria-labelledby="topics-h"><h2 id="topics-h">Topics</h2><ul class="chips">${topics.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>` : ""}
      ${yt && ytHref ? `<section class="yt-block stone" aria-label="YouTube">
          ${yt.image && yt.image.src ? `<div class="yt-media">${img(yt.image, "yt-img")}</div>` : ""}
          <div class="yt-body">
            ${yt.description ? `<p>${esc(yt.description)}</p>` : ""}
            <a class="btn btn-big" href="${esc(ytHref)}" target="_blank" rel="noopener">${esc(yt.label || "YouTube")} →</a>
          </div>
        </section>` : ""}`;
  }

  // Let's Get Coffee: booking link first, email beneath, no form.
  const contact = document.getElementById("contact");
  if (contact) {
    const C = window.CONTACT || {};
    const primary = S.calendar
      ? `<a class="btn btn-big" href="${esc(S.calendar)}" target="_blank" rel="noopener">${esc(C.calendarLabel || "Google Calendar")} →</a>`
      : `<a class="btn btn-big" href="${mailto}">${esc(S.email)}</a>`;
    contact.innerHTML = `<h1>${esc(C.title || "Let's Get Coffee")}</h1>${lede(C.lede)}
      <div class="contact-actions">${primary}</div>
      <p class="contact-email">${C.emailLabel ? `<span>${esc(C.emailLabel)}</span> ` : ""}<a href="${mailto}">${esc(S.email)}</a></p>
      <div class="contact-secondary">
        ${S.linkedin ? `<a class="btn" href="${esc(S.linkedin)}" target="_blank" rel="noopener">LinkedIn →</a>` : ""}
        ${S.github ? `<a class="btn" href="${esc(S.github)}" target="_blank" rel="noopener">GitHub →</a>` : ""}
      </div>`;
  }
})();
