#!/usr/bin/env node
/*
 * Content integrity and public-disclosure check. Node only, no dependencies.
 *
 * 1. Launch markers: fails on TODO, [CONFIRM, DRAFT, lorem ipsum in shipped files
 *    (*.html at the repo root, js/**, css/**). Comments count: js/ and css/ ship to the public.
 * 2. Banned copy words (CLAUDE.md): passionate, revolutionize, innovative, leverage.
 * 3. Disclosure: blocked terms come ONLY from the environment, never from the repo:
 *      DISCLOSURE_TERMS       newline-separated terms (CI: repository secret)
 *      DISCLOSURE_TERMS_FILE  path to a local file OUTSIDE the repo (optional, for local runs)
 *    Matching is case-insensitive. All shipped files are scanned (text files' contents and
 *    every file's path, including assets/). Matches print file:line and the term's index
 *    in the list, never the term or the matching line.
 *    If neither variable is set, the disclosure check is skipped with a warning (exit 0 locally;
 *    in CI, i.e. when CI=true, a missing secret is a failure so a deploy can't silently skip it).
 *
 * Known gap: binary files (PDF, images) are not text-scanned. assets/resume.pdf must be
 * reviewed by hand or text-extracted before a deploy.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const TEXT_EXT = /\.(html?|js|mjs|css|json|svg|txt|md|xml|webmanifest|vtt|srt)$/i;

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rootHtml = readdirSync(ROOT).filter((f) => /\.html$/i.test(f)).map((f) => join(ROOT, f));
const codeFiles = [...rootHtml, ...walk(join(ROOT, "js")), ...walk(join(ROOT, "css"))].filter((f) => TEXT_EXT.test(f));
const shipped = [...rootHtml, ...walk(join(ROOT, "js")), ...walk(join(ROOT, "css")), ...walk(join(ROOT, "assets"))];

const rel = (f) => relative(ROOT, f).split(sep).join("/");
const failures = [];
const warnings = [];

function scan(files, rules, category) {
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const r of rules) {
        const m = line.match(r.re);
        if (m) failures.push(`${category}: ${rel(f)}:${i + 1}: ${r.label}${r.showMatch ? ` ("${m[0]}")` : ""}`);
      }
    });
  }
}

// 1. Launch markers ("Demo coming soon" style workbench text is allowed: nothing here matches it).
scan(
  codeFiles,
  [
    { re: /\bTODO\b/, label: "TODO marker" },
    { re: /\[CONFIRM/i, label: "[CONFIRM marker" },
    { re: /\bDRAFT\b/, label: "DRAFT marker" },
    { re: /lorem\s+ipsum/i, label: "lorem ipsum" },
  ],
  "marker"
);

// 2. Banned words (shipped copy; also catches them in code comments, which also ship).
scan(
  codeFiles,
  [
    { re: /\bpassionate(ly)?\b/i, label: "banned word", showMatch: true },
    { re: /\brevolutioni[sz](e|es|ed|ing)\b/i, label: "banned word", showMatch: true },
    { re: /\binnovative(ly)?\b/i, label: "banned word", showMatch: true },
    { re: /\bleverag(e|es|ed|ing)\b/i, label: "banned word", showMatch: true },
  ],
  "copy"
);

// 3. Disclosure.
let raw = process.env.DISCLOSURE_TERMS || "";
const termsFile = process.env.DISCLOSURE_TERMS_FILE;
if (termsFile) {
  const abs = resolve(termsFile);
  if (abs.startsWith(ROOT + sep)) {
    failures.push("disclosure: DISCLOSURE_TERMS_FILE must live outside the repository");
  } else if (existsSync(abs)) {
    raw += "\n" + readFileSync(abs, "utf8");
  } else {
    failures.push("disclosure: DISCLOSURE_TERMS_FILE does not exist");
  }
}
const terms = raw
  .split(/\r?\n/)
  .map((t) => t.trim())
  .filter((t) => t && !t.startsWith("#"))
  .map((t) => t.toLowerCase());

let disclosureStatus;
if (!terms.length) {
  const msg = "skipped: DISCLOSURE_TERMS not set (disclosure check did not run)";
  if (process.env.CI === "true" && !termsFile) {
    failures.push(`disclosure: ${msg}; add the DISCLOSURE_TERMS repository secret`);
    disclosureStatus = "FAIL (secret missing in CI)";
  } else {
    warnings.push(msg);
    disclosureStatus = "SKIPPED";
  }
} else {
  const before = failures.length;
  for (const f of shipped) {
    const path = rel(f).toLowerCase();
    terms.forEach((t, k) => {
      if (path.includes(t)) failures.push(`disclosure: ${rel(f)} (file path): blocked term #${k + 1} [redacted]`);
    });
    if (!TEXT_EXT.test(f)) continue;
    readFileSync(f, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const l = line.toLowerCase();
        terms.forEach((t, k) => {
          if (l.includes(t)) failures.push(`disclosure: ${rel(f)}:${i + 1}: blocked term #${k + 1} [redacted]`);
        });
      });
  }
  disclosureStatus = failures.length > before ? "FAIL" : `PASS (${terms.length} terms, ${shipped.length} files)`;
  const binaries = shipped.filter((f) => !TEXT_EXT.test(f) && /\.pdf$/i.test(f)).map(rel);
  if (binaries.length) warnings.push(`not text-scanned (binary; check by hand): ${binaries.join(", ")}`);
}

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const f of failures) console.error(`FAIL  ${f}`);
console.log(
  `\ncontent-integrity: scanned ${codeFiles.length} code files; markers+copy ${
    failures.filter((f) => !f.startsWith("disclosure")).length ? "FAIL" : "PASS"
  }; disclosure ${disclosureStatus}`
);
process.exit(failures.length ? 1 : 0);
