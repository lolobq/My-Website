/* Shared header (photo square + name bar + buttons) used on every page. */
(function () {
  const S = window.SITE;

  // 9x9 pixel icons. "#" = filled.
  const ICONS = {
    reflections: [
      ".........",
      "###...###",
      "#..#.#..#",
      "#.##.##.#",
      "#..#.#..#",
      "#.##.##.#",
      "#..#.#..#",
      "####.####",
      ".........",
    ],
    email: [
      ".........",
      "#########",
      "##.....##",
      "#.#...#.#",
      "#..#.#..#",
      "#...#...#",
      "#.......#",
      "#########",
      ".........",
    ],
    resume: [
      ".######..",
      ".#....##.",
      ".#.##..#.",
      ".#.....#.",
      ".#.###.#.",
      ".#.....#.",
      ".#.###.#.",
      ".#.....#.",
      ".#######.",
    ],
    linkedin: [
      "#########",
      "#.......#",
      "#.#.....#",
      "#.......#",
      "#.#.###.#",
      "#.#.#.#.#",
      "#.#.#.#.#",
      "#.......#",
      "#########",
    ],
    github: [
      ".........",
      "..#...#..",
      ".#.....#.",
      "#...#...#",
      "#..#....#",
      "#...#...#",
      ".#.....#.",
      "..#...#..",
      ".........",
    ],
  };

  function icon(name) {
    const rows = ICONS[name];
    let rects = "";
    rows.forEach((r, y) =>
      [...r].forEach((c, x) => {
        if (c === "#") rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      })
    );
    return `<svg class="icon" viewBox="0 0 9 9" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor">${rects}</svg>`;
  }

  const mailto =
    `mailto:${S.email}` + (S.emailSubject ? `?subject=${encodeURIComponent(S.emailSubject)}` : "");

  const buttons = [
    { id: "reflections", label: "Reflections", href: "reflections.html" },
    { id: "email", label: "Email", href: mailto },
    { id: "resume", label: "Resume", href: "resume.html" },
    { id: "linkedin", label: "LinkedIn", href: S.linkedin, external: true },
    { id: "github", label: "GitHub", href: S.github, external: true },
  ];

  const header = document.getElementById("site-header");
  if (!header) return;

  const here = location.pathname.split("/").pop() || "index.html";

  header.innerHTML = `
    <a class="photo pixel-box" href="index.html" aria-label="${S.name}, home">
      ${S.photo ? `<img src="${S.photo}" alt="Photo of ${S.name}">` : `<canvas id="avatar" width="24" height="24" aria-hidden="true"></canvas>`}
    </a>
    <div class="bar pixel-box">
      <a class="who" href="index.html">
        <span class="name">${S.name}</span>
        <span class="tagline">${S.tagline}</span>
      </a>
      <nav class="actions" aria-label="Links">
        ${buttons
          .map(
            (b) =>
              `<a class="nav-link${here === b.href ? " is-current" : ""}" href="${b.href}"${
                b.external ? ' target="_blank" rel="noopener"' : ""
              }>${b.label}</a>`
          )
          .join("")}
      </nav>
    </div>`;

  // Placeholder portrait: the sprite's head drawn into the photo square.
  const av = document.getElementById("avatar");
  if (av && window.Sprites) window.Sprites.drawAvatar(av);
})();
