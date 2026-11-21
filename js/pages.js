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

    // Dynamic view: one stone slab per role, plus skills, education, honors and publications.
    const dynamic = `
      ${R.summary ? `<section class="resume-card stone"><p class="resume-summary">${esc(R.summary)}</p></section>` : ""}
      ${exp.map((e) => `<section class="resume-card stone">
          <p class="kicker">${meta(e.dates, e.location)}</p>
          <h2>${esc(e.org)}</h2>
          <p class="resume-role">${esc(e.role)}</p>
          ${ul(e.bullets)}
        </section>`).join("")}
      ${skills.length ? `<section class="resume-card stone">
          <h2>Skills</h2>
          ${skills.map((s) => `<h3>${esc(s.label)}</h3><ul class="chips">${(s.items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`).join("")}
        </section>` : ""}
      ${edu.length ? `<section class="resume-card stone">
          <h2>Education</h2>
          ${edu.map((e) => `<h3>${esc(e.school)}</h3><p>${meta(e.degree, e.dates, e.note)}</p>`).join("")}
        </section>` : ""}
      ${honors.length || pubs.length ? `<section class="resume-card stone">
          ${honors.length ? `<h2>Honors</h2>${ul(honors)}` : ""}
          ${pubs.length ? `<h2>Publications</h2><ul>${pubs.map((p) => `<li>${pubLink(p)}</li>`).join("")}</ul>` : ""}
        </section>` : ""}`;

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

    resume.innerHTML = `
      <div class="resume-head stone">
        <h1 id="resume-heading" tabindex="-1">${esc(R.title || "Resume")}</h1>
        ${R.lede ? `<p class="lede">${esc(R.lede)}</p>` : ""}
        <div class="resume-actions">
          <div class="view-toggle" role="group" aria-label="Resume view">
            <button class="btn" type="button" data-view="dynamic" aria-pressed="true">Dynamic view</button>
            <button class="btn" type="button" data-view="document" aria-pressed="false">Document view</button>
          </div>
          <a class="btn btn-link" href="${esc(pdf)}" download>Download PDF</a>
          <a class="btn btn-quiet" href="${esc(pdf)}" target="_blank" rel="noopener">Open PDF</a>
        </div>
      </div>
      <div class="resume-dynamic" id="resume-dynamic">${dynamic}</div>
      <article class="resume-doc pixel-box" id="resume-document" aria-labelledby="resume-heading" hidden>${documentView}</article>`;

    // View switching: #dynamic / #document deep links, back/forward, last choice per session.
    const VIEWS = ["dynamic", "document"];
    const heading = resume.querySelector("#resume-heading");
    const dyn = resume.querySelector("#resume-dynamic");
    const doc = resume.querySelector("#resume-document");
    const btns = [...resume.querySelectorAll(".view-toggle .btn")];
    const fromHash = () => { const v = location.hash.slice(1); return VIEWS.includes(v) ? v : null; };
    const stored = () => { try { const v = sessionStorage.getItem("resume-view"); return VIEWS.includes(v) ? v : null; } catch (e) { return null; } };
    function show(view, focus) {
      dyn.hidden = view !== "dynamic";
      doc.hidden = view !== "document";
      document.body.dataset.resumeView = view;
      btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
      try { sessionStorage.setItem("resume-view", view); } catch (e) {}
      if (focus) heading.focus();
    }
    btns.forEach((b) =>
      b.addEventListener("click", () => {
        const v = b.dataset.view;
        if (fromHash() !== v) history.pushState(null, "", `#${v}`);
        show(v, false);
      })
    );
    const onNav = () => { const v = fromHash() || "dynamic"; show(v, v === "document"); };
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
    const initial = fromHash() || stored() || "dynamic";
    show(initial, initial === "document" && !!fromHash());

    // Slabs rise in as they scroll into view (transforms and opacity only; off for reduced motion).
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      const cards = [...dyn.querySelectorAll(".resume-card")];
      dyn.classList.add("will-reveal");
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        });
      }, { rootMargin: "0px 0px -8% 0px" });
      cards.forEach((c, i) => { c.style.setProperty("--d", `${Math.min(i, 3) * 70}ms`); io.observe(c); });
    }
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

  // Projects: full case studies, then the "On the workbench" grid.
  const projects = document.getElementById("projects");
  if (projects) {
    const P = window.PROJECTS && !Array.isArray(window.PROJECTS) ? window.PROJECTS : {};
    const cases = P.caseStudies || [];
    const bench = P.workbench || [];
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
    projects.innerHTML = `<h1>${esc(P.title || "Projects")}</h1>${lede(P.lede)}
      ${cases.map((c) => `<article class="case-study"${c.id ? ` id="${esc(c.id)}"` : ""}>
          ${c.tag ? `<p class="item-meta">${esc(c.tag)}</p>` : ""}
          <h2>${esc(c.title)}</h2>
          ${c.summary ? `<p class="case-summary">${esc(c.summary)}</p>` : ""}
          ${(c.sections || []).map((s) => `<section>${s.heading ? `<h3>${esc(s.heading)}</h3>` : ""}${paras(s.body)}</section>`).join("")}
          ${links(c.links)}
        </article>`).join("")}
      ${bench.length ? `<section class="workbench" aria-labelledby="workbench-h">
          <h2 id="workbench-h">On the workbench</h2>
          <ul class="wb-grid">${bench.map((w) => `<li class="wb-card">
              <div class="wb-media">${media(w)}</div>
              <div class="wb-body">
                ${w.status && w.media && w.media.src ? `<p class="item-meta">${esc(w.status)}</p>` : ""}
                <h3>${esc(w.title)}</h3>
                ${w.description ? `<p>${esc(w.description)}</p>` : ""}
                ${links(w.links)}
              </div>
            </li>`).join("")}</ul>
        </section>` : ""}`;
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
