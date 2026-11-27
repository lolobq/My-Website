#!/usr/bin/env node
/*
 * Local gate against accidentally committing or pushing blocked terms. Node built-ins only.
 * Its sole purpose is to stop mistakes before they reach GitHub. It is not a lock:
 * `git commit --no-verify` / `git push --no-verify` skip it. The CI check (tests/content-integrity.mjs)
 * stays as the final gate before deploy.
 *
 *   node .githooks/check.mjs pre-commit        scans staged paths and added lines
 *   node .githooks/check.mjs commit-msg FILE   scans the commit message
 *   node .githooks/check.mjs pre-push          scans every new commit (message, paths, added lines); reads hook stdin
 *
 * Terms: one per line in `.disclosure-terms.local` at the repo root (git-ignored) or the file named by
 * DISCLOSURE_TERMS_FILE. Case-insensitive; blank lines and lines starting with # are ignored.
 * Output never prints a term or the matching line: only the term's number and where it matched.
 * If there is no terms file the gate warns loudly and lets the commit through, so set the file up.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const ROOT = git("rev-parse", "--show-toplevel").trim();
const TERMS_FILE = process.env.DISCLOSURE_TERMS_FILE ? resolve(process.env.DISCLOSURE_TERMS_FILE) : resolve(ROOT, ".disclosure-terms.local");
const IGNORED_NAME = ".disclosure-terms.local";
const ZERO = /^0+$/;

const mode = process.argv[2];

if (!existsSync(TERMS_FILE)) {
  console.warn(`\nWARNING: push gate is OFF: no terms file at ${TERMS_FILE}.`);
  console.warn("Create it with one blocked term per line (it is git-ignored), then this check will run.\n");
  process.exit(0);
}

const terms = readFileSync(TERMS_FILE, "utf8")
  .split(/\r?\n/)
  .map((t) => t.trim())
  .filter((t) => t && !t.startsWith("#"))
  .map((t) => t.toLowerCase());

if (!terms.length) {
  console.warn(`\nWARNING: push gate is OFF: ${TERMS_FILE} has no terms.\n`);
  process.exit(0);
}

const hits = [];
const scanText = (text, where, onlyAdded = false) => {
  text.split(/\r?\n/).forEach((line, i) => {
    if (onlyAdded && !(line.startsWith("+") && !line.startsWith("+++"))) return;
    const l = line.toLowerCase();
    terms.forEach((t, k) => {
      if (l.includes(t)) hits.push(`${where}${onlyAdded ? "" : `:${i + 1}`}: blocked term #${k + 1} [redacted]`);
    });
  });
};
// Never print the path itself (it may contain the term): only that a path matched.
const scanPathSafe = (path, where) => {
  const p = path.toLowerCase();
  terms.forEach((t, k) => {
    if (p.includes(t)) hits.push(`${where}: a file path contains blocked term #${k + 1} [redacted]`);
  });
};

if (mode === "pre-commit") {
  const staged = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0").filter(Boolean);
  if (staged.includes(IGNORED_NAME)) hits.push("the terms file itself is staged: unstage it (git restore --staged .disclosure-terms.local)");
  staged.forEach((p) => scanPathSafe(p, "staged files"));
  scanText(git("diff", "--cached", "-U0", "--no-color", "--diff-filter=ACMR"), "staged changes", true);
} else if (mode === "commit-msg") {
  scanText(readFileSync(process.argv[3], "utf8"), "commit message");
} else if (mode === "pre-push") {
  const stdin = readFileSync(0, "utf8").split(/\r?\n/).filter(Boolean);
  const seen = new Set();
  for (const row of stdin) {
    const [, localSha, , remoteSha] = row.split(" ");
    if (!localSha || ZERO.test(localSha)) continue; // deleting a branch
    const range = remoteSha && !ZERO.test(remoteSha) ? [`${remoteSha}..${localSha}`] : [localSha, "--not", "--remotes"];
    for (const sha of git("rev-list", ...range).split(/\r?\n/).filter(Boolean)) {
      if (seen.has(sha)) continue;
      seen.add(sha);
      const short = sha.slice(0, 7);
      scanText(git("show", "-s", "--format=%B", sha), `commit ${short} message`);
      git("diff-tree", "--root", "-r", "--no-commit-id", "--name-only", "-z", sha).split("\0").filter(Boolean).forEach((p) => scanPathSafe(p, `commit ${short}`));
      scanText(git("show", "--format=", "-U0", "--no-color", sha), `commit ${short} changes`, true);
    }
  }
} else {
  console.error("usage: check.mjs pre-commit | commit-msg FILE | pre-push");
  process.exit(2);
}

if (hits.length) {
  console.error(`\nBLOCKED (${mode}): ${hits.length} match(es). Terms are in ${TERMS_FILE}; this output never shows them.`);
  [...new Set(hits)].slice(0, 30).forEach((h) => console.error(`  - ${h}`));
  console.error("\nRemove it and try again. (git ... --no-verify skips this gate; CI still checks shipped files.)\n");
  process.exit(1);
}
process.exit(0);
