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
    const pdf = window.SITE.resumePdf;
    resume.innerHTML = `<h1>Resume</h1>
      <div class="resume-actions">
        <a class="btn btn-link" href="${esc(pdf)}" download>Download PDF</a>
        <a class="btn" href="${esc(pdf)}" target="_blank" rel="noopener">Open in new tab</a>
      </div>
      <iframe class="resume-frame" src="${esc(pdf)}#view=FitH" title="Lauren's resume"></iframe>`;
  }
})();
