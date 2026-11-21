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
      document.title = `${post.title} · Reflections`;
      blog.innerHTML = `<article class="post">
        <a class="btn back" href="reflections.html">← All reflections</a>
        <time datetime="${esc(post.date)}">${fmt(post.date)}</time>
        <h1>${esc(post.title)}</h1>
        ${(post.body || []).map((p) => `<p>${esc(p)}</p>`).join("")}
      </article>`;
    } else {
      blog.innerHTML = `<h1>Reflections</h1>
        <p class="lede">Notes from the workshop: what I'm learning, building and chiseling away at.</p>
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
    about.innerHTML = `<div class="about-head">${S.photo ? `<img class="about-photo" src="${esc(S.photo)}" alt="Photo of ${esc(S.name)}">` : ""}
      <div><h1>${esc(A.title || "About")}</h1><p class="lede">${esc(S.tagline)}</p></div></div>${paras(A.body)}`;
  }

  const listPage = (el, title, lede, items, meta) => {
    el.innerHTML = `<h1>${title}</h1><p class="lede">${lede}</p><ul class="item-list">${items
      .map((it) => `<li><p class="item-meta">${esc(meta(it))}</p><h2>${esc(it.title)}</h2>${paras(it.description)}${links(it.links)}</li>`)
      .join("")}</ul>`;
  };
  const projects = document.getElementById("projects");
  if (projects) listPage(projects, "Projects", "Things I've built and am building.", window.PROJECTS || [], (it) => it.tag || "");
  const speaking = document.getElementById("speaking");
  if (speaking) listPage(speaking, "Speaking", "Panels, podcasts and talks.", window.TALKS || [], (it) => [it.event, it.date].filter(Boolean).join(" · "));

  const contact = document.getElementById("contact");
  if (contact) {
    contact.innerHTML = `<h1>Let's sculpt together.</h1>
      <p class="lede">The best way to reach me is email. I'm also on LinkedIn and GitHub.</p>
      <div class="contact-actions">
        <a class="btn btn-big" href="${mailto}">Email me</a>
        <a class="btn" href="${esc(S.linkedin)}" target="_blank" rel="noopener">LinkedIn →</a>
        <a class="btn" href="${esc(S.github)}" target="_blank" rel="noopener">GitHub →</a>
      </div>
      <p class="contact-email">${esc(S.email)}</p>`;
  }
})();
