# Lauren Bourque — Portfolio Site

Read this first, every session. It is the source of truth for what this site is for.
Full background, card copy, and project details live in `docs/brief.md`.

## Launch deadline

**Live on GitHub Pages by end of day Sunday, Nov 23, 2026.** Scope decisions favor shipping:
a polished, smaller site beats an unfinished bigger one. Anything not ready ships as an
intentional "On the workbench" slot or is hidden, never as a broken or empty page.

## ⚠️ Existing code first (hard rule)

**The site is already partly built. We are continuing it, not starting over.**
- Before any change, read the existing files and understand what's there.
- Never delete, replace, or rewrite an existing file wholesale. Make targeted edits (the Edit
  tool, not Write) to existing files; create new files only for genuinely new pieces.
- Keep the existing look, structure, naming, and the sculptor animation. Extend them.
- If something existing seems wrong, report it to the orchestrator with a proposed fix and wait for
  Lauren's approval. Don't "clean it up" on your own.
- Work on a git branch; commit after each completed step so anything can be rolled back.

## Mission

In 30 seconds, a hiring manager should think: **"She gets shit done."**
(That's the internal goal. Public copy says it with proof, not profanity.)

The site lands Lauren a role at a **health/biotech company first** (Function Health, Neuralink,
Abridge, DeepScribe, Tempus), in a **forward deployed engineer (FDE)** or applied AI role,
because that is where her skill set is strongest. It also works for FDE roles at AI and
big-tech companies.

## The thesis (everything on the site serves this)

> "Every block of stone has a statue inside it, and it is the task of the sculptor to discover it."
> — attributed to Michelangelo

**Lauren's take:** You don't find yourself. You *create* yourself. The tools are already inside
you; you apply them, and you reveal what was always there. Self-discovery is really self-creation.

On the site this becomes: she takes raw material (a legacy system, a room full of ideas, a body
after hip surgery, a blank page) and carves something real out of it, with a smile on her face
and a chip on her shoulder. That is also the FDE job: walk into a messy environment and build
the thing that was possible all along.

The homepage tells this story in three beats:
1. **Quote** (Michelangelo: the statue is *discovered*)
2. **Cards** (what her younger self wanted, and what she did about it)
3. **Closing card** (Lauren's twist: the statue is *created*. Let's build yours together.)

## Who we are building for

Primary reader: a hiring manager or recruiter at a health/biotech company, then AI-native
and big-tech FDE teams. They give the site 30–60 seconds, often on a phone. They must leave knowing:
1. She ships: production systems, real scale, real money ($4M/year saved, 7M clients).
2. She works with executives and customers, not just tickets.
3. She builds AI hands-on.
4. She does hard things: a patent filing, a bodybuilding stage after surgery, All-American athlete.

## Non-negotiables

- **Professional first, personality second.** Personality supports the engineering story; it
  never replaces it. Builder and personal cards alternate.
- **Proof over adjectives.** Numbers, links, photos. Never write "passionate," "revolutionize,"
  "innovative," or "leverage."
- **Her voice:** direct, warm, confident, playful. Short sentences. Like talking over coffee.
- **Accuracy:** never inflate. She did *part* of the legacy migration, not all of it. She *led*
  the innovation capstone.

## Public-disclosure rules (cleared by Lauren; hard rules)

- ✅ $4M/year savings: may be shared (as a resume line or card, never as a project or demo).
- ✅ The innovation capstone: may be shared.
- ✅ "Inventor on a USPTO patent filing": may be shared. ❌ Never describe what the patent is for.
- ❌ **The startup is "a stealth AI startup."** No name, logo, screenshots, demo video, or code
  until Wells Fargo clears it. A generic description of the problem and her role is fine.
- ❌ No internal Wells Fargo system names or confidential details.

## Site structure

### Home
1. On load: the Michelangelo quote at the top.
2. Center: the sculptor carving (**already built; do not rebuild it, integrate with it**).
3. Below the sculptor, two buttons side by side: **Scroll to reveal** and **Skip to work**
   (goes to the Resume tab in its HTML document view).
4. **Prologue** (one line, see `docs/brief.md`) introduces the cards.
5. **Identity cards** appear left and right while scrolling, alternating builder and personal.
   Format: "My younger self always wanted to ___." → "So I did." + proof.
6. **Closing card**: the common thread and Lauren's create-yourself twist, with a
   **Let's grab coffee** button.

### Top-right tabs
- **Resume:** dynamic view ↔ document view (real HTML text) plus "Download PDF."
- **Projects:** 2 completed case studies (SmartCity NSF app, innovation capstone), plus an
  "On the workbench" section of 3 cards whose media slots hold a placeholder until the demo exists.
  The Wells Fargo legacy modernization is **not** a project (company property); it lives on the
  Resume and in the identity cards only.
- **About:** the full story, including the create-yourself philosophy.
- **Writing:** hide this tab at launch if there are no posts; show it once one exists.
- **Speaking:** photos, clips, and topics.
- **Let's get coffee:** Google Calendar booking link and email, visible with no form.

## Tech constraints

- Plain HTML, CSS, vanilla JS on GitHub Pages (static only). No framework unless truly required.
- Mobile-first. Respect `prefers-reduced-motion`.
- Dev-only tooling (tests, Lighthouse) via npm devDependencies is fine.

## Agents and file ownership

The main session is the **orchestrator**. It plans, delegates, merges, and reports to Lauren.

| Agent | Owns (may edit) | Role |
|---|---|---|
| `copywriter` | `js/**`, `*.html` | All words |
| `builder` | `*.html`, `css/**`, `js/**`, `assets/**` | Layout, animation, interaction |
| `qa` | `tests/**`, test configs, `.github/workflows/**` | All testing and CI |
| `fde-reviewer` | nothing (read-only) | Reviews as target-company hiring managers |

Orchestrator rules:
- Run independent work in parallel; review after.
- After every meaningful change, run `qa`, then `fde-reviewer`.
- Never mark work done while QA is failing.
- Bring Lauren decisions that are hers: her story and words, disclosure questions, and any
  claim not confirmed in `docs/brief.md`.

## Definition of Done

- All tests pass (unit, e2e, accessibility, links).
- Lighthouse (mobile): Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO ≥ 95.
- LCP < 2.5s, CLS < 0.1, INP < 200ms.
- No broken links, no console errors; works at 375px and on desktop.
- No `TODO`, `[CONFIRM]`, or `DRAFT` markers on shipped pages. (Intentional "On the
  workbench / demo coming soon" slots are allowed.)
- Nothing violates the public-disclosure rules.
