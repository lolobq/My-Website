/* Reflections (blog) and Resume pages. */
(function () {
  const h = document.getElementById("site-header");
  if (h) document.documentElement.style.setProperty("--header-h", h.getBoundingClientRect().bottom + "px");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const blog = document.getElementById("reflections");
  if (blog) {
    const posts = window.POSTS || [];
    const slug = new URLSearchParams(location.search).get("post");
    const post = posts.find((p) => p.slug === slug);
    if (post) {
      document.title = `${post.title} · Writing`;
      blog.innerHTML = `<article class="post">
        <a class="btn back" href="reflections.html">← All writing</a>
        <time datetime="${esc(post.date)}">${fmt(post.date)}</time>
        <h1>${esc(post.title)}</h1>
        ${(post.body || []).map((p) => `<p>${esc(p)}</p>`).join("")}
      </article>`;
    } else {
      blog.innerHTML = `<h1>Writing</h1>
        ${window.WRITING && window.WRITING.lede ? `<p class="lede">${esc(window.WRITING.lede)}</p>` : ""}
        <ul class="post-list">${posts
          .map((p) => `<li><a href="reflections.html?post=${encodeURIComponent(p.slug)}">
            <time datetime="${esc(p.date)}">${fmt(p.date)}</time>
            <h2>${esc(p.title)}</h2><p>${esc(p.excerpt || "")}</p></a></li>`)
          .join("")}</ul>`;
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
          <h3>${esc(e.role)}, ${esc(e.org)}</h3>
          <p class="doc-meta">${meta(e.location, e.dates)}</p>
          ${ul(e.bullets)}
        </article>`).join("")}</section>` : ""}
      ${edu.length ? `<section><h2>Education</h2>${edu.map((e) => `<article class="doc-role">
          <h3>${esc(e.school)}</h3><p class="doc-meta">${meta(e.degree, e.dates, e.note)}</p>
        </article>`).join("")}</section>` : ""}
      ${skills.length ? `<section><h2>Skills</h2><ul class="doc-skills">${skills.map((s) => `<li><strong>${esc(s.label)}:</strong> ${(s.items || []).map(esc).join(", ")}</li>`).join("")}</ul></section>` : ""}
      ${honors.length ? `<section><h2>Honors</h2>${ul(honors)}</section>` : ""}
      ${pubs.length ? `<section><h2>Publications</h2><ul>${pubs.map((p) => `<li>${pubLink(p)}</li>`).join("")}</ul></section>` : ""}`;

    // The PDF is the page: Download / Open in new tab, then the embedded PDF where it renders well.
    // Phones and touch screens get no frame (Android shows nothing, iOS only page 1); the buttons
    // are the path there. The HTML text version stays below for screen readers, search and no-PDF.
    resume.innerHTML = `
      <section id="document" class="resume-pdf" aria-labelledby="resume-heading">
        <div class="resume-head stone">
          <div class="resume-title">
            <h1 id="resume-heading" tabindex="-1">${esc(R.title || "Resume")}</h1>
            ${R.lede ? `<p class="lede">${esc(R.lede)}</p>` : ""}
          </div>
          <div class="resume-actions">
            <a class="btn btn-link" href="${esc(pdf)}" download>Download PDF</a>
            <a class="btn" href="${esc(pdf)}" target="_blank" rel="noopener">Open in new tab</a>
          </div>
        </div>
        <div class="resume-frame-slot"></div>
      </section>
      <details class="resume-text stone">
        <summary>Text version</summary>
        <article class="resume-doc" id="resume-document" aria-label="${esc(R.title || "Resume")}, text version">${documentView}</article>
      </details>`;

    const slot = resume.querySelector(".resume-frame-slot");
    const wide = matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
    const canEmbed = () => navigator.pdfViewerEnabled !== false && wide.matches;
    const placeFrame = () => {
      const has = !!slot.firstChild;
      if (canEmbed() && !has) {
        slot.innerHTML = `<iframe class="resume-frame" src="${esc(pdf)}#view=FitH&navpanes=0" title="${esc([S.name, R.title || "Resume"].filter(Boolean).join(", "))} (PDF)"></iframe>`;
      } else if (!canEmbed() && has) slot.textContent = "";
      document.body.classList.toggle("has-pdf-frame", !!slot.firstChild);
    };
    placeFrame();
    if (wide.addEventListener) wide.addEventListener("change", placeFrame);

    // Skip to work lands on #document: focus the heading at the top of the PDF region.
    const heading = resume.querySelector("#resume-heading");
    // (Again after load: the browser's own jump to #document would otherwise reset focus.)
    const focusHeading = () => { if (location.hash === "#document") heading.focus(); };
    focusHeading();
    window.addEventListener("load", () => setTimeout(focusHeading, 0));
    window.addEventListener("hashchange", focusHeading);

    // Printing prints the text version, so open it first.
    const text = resume.querySelector(".resume-text");
    let wasOpen = false;
    window.addEventListener("beforeprint", () => { wasOpen = text.open; text.open = true; });
    window.addEventListener("afterprint", () => { text.open = wasOpen; });
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

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    projects.innerHTML = `<div class="projects-head stone"><h1>${esc(P.title || "Projects")}</h1>${lede(P.lede)}</div>
      <ul class="tiles${reduce ? "" : " is-entering"}">${tiles.map((it, i) => `<li class="tile stone" style="--i:${i}">
          <h2 class="tile-title"><a class="tile-link" href="#${esc(it.key)}" data-panel="${esc(it.key)}" aria-haspopup="dialog">${tw(it.title)}</a></h2>
          ${it.meta ? `<p class="tile-meta">${tw(it.meta)}</p>` : ""}
          ${it.line ? `<p class="tile-line">${tw(it.line)}</p>` : ""}
          <span class="tile-more" aria-hidden="true">→</span>
        </li>`).join("")}</ul>
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

    // Panels: native modal dialogs (focus moves in, Esc closes, the page behind is inert).
    let opener = null;
    const dialogs = [...projects.querySelectorAll("dialog.project-panel")];
    const keyOf = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ""; } };
    const openPanel = (key) => {
      const d = byKey.has(key) ? dialogs.find((x) => x.id === key) : null;
      if (!d) return false;
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

  // Let's get coffee: booking link first, email beneath, no form.
  const contact = document.getElementById("contact");
  if (contact) {
    const C = window.CONTACT || {};
    const primary = S.calendar
      ? `<a class="btn btn-big" href="${esc(S.calendar)}" target="_blank" rel="noopener">${esc(C.calendarLabel || "Google Calendar")} →</a>`
      : `<a class="btn btn-big" href="${mailto}">${esc(S.email)}</a>`;
    contact.innerHTML = `<h1>${esc(C.title || "Let's get coffee")}</h1>${lede(C.lede)}
      <div class="contact-actions">${primary}</div>
      <p class="contact-email">${C.emailLabel ? `<span>${esc(C.emailLabel)}</span> ` : ""}<a href="${mailto}">${esc(S.email)}</a></p>
      <div class="contact-secondary">
        ${S.linkedin ? `<a class="btn" href="${esc(S.linkedin)}" target="_blank" rel="noopener">LinkedIn →</a>` : ""}
        ${S.github ? `<a class="btn" href="${esc(S.github)}" target="_blank" rel="noopener">GitHub →</a>` : ""}
      </div>`;
  }
})();
