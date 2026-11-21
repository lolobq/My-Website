# Orchestrator prompts

Paste these into Claude Code at the repo root. The main session is the orchestrator.

## 0. Before anything (do this yourself in the terminal)
```
git add -A && git commit -m "Snapshot before agent build"
git checkout -b agent-build
```
Now nothing can be lost: `git checkout main` always gets your current site back.

## 1. Audit first (no edits)
Read CLAUDE.md and docs/brief.md. The site is already partly built; we are continuing it, not
starting over. Do NOT edit any files yet. Read the entire existing codebase and give me:
1. What already exists (pages, sections, the sculptor animation, styles, scripts, content).
2. What's missing or different compared with CLAUDE.md.
3. A step-by-step build plan that only adds to or edits existing files, with each step tagged
   to the agent that owns it.
Wait for my approval before building.

## 2. Build (after approving the audit plan)
Execute the approved plan. Rules: targeted edits only, never rewrite or delete existing files,
keep the sculptor animation untouched, and commit after each completed step. First have qa
capture the baseline screenshots. Then, in parallel:
- copywriter: prologue, 6 identity cards, closing card, resume document view, the 2 completed case
  studies, and the 3 workbench cards. Use "approved" copy from the brief verbatim.
- builder: the missing pieces from the plan (buttons, prologue, cards, closing card, tabs,
  resume toggle, workbench media slots, coffee page), built into the existing code.
- qa: test tooling and CI, critical journeys, accessibility, links, Lighthouse, disclosure checks.
Then wire the content in, run qa and fde-reviewer in parallel, and give me one ranked fix list
plus any [CONFIRM] items still open.

## 3. Fix loop
Read CLAUDE.md. Run qa and fde-reviewer in parallel. Give me a ranked fix plan (launch blockers
first); after I approve, route each fix to its owning agent. Rerun qa until everything passes.

## 4. Pre-launch check
Full qa suite plus Lighthouse, and fde-reviewer. Confirm the Definition of Done, no
[CONFIRM]/TODO/DRAFT markers, and no disclosure violations. Then merge agent-build into main,
walk me through GitHub Pages, and verify the live URL.

## 5. After December 5 (the bodybuilding show)
Update identity card 2 to "…and stepped on stage on December 5" and swap the before/after photo
for the stage photo at [path]. Then qa.

## 6. Swap in a demo (later)
A demo is ready for [project] at [path/URL]. builder: replace its workbench placeholder.
copywriter: upgrade the card into a full case study. Then qa and fde-reviewer.
