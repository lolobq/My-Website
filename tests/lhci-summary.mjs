// Diagnostic only: summarise Lighthouse CI results (lhr-*.json) as compact text for the CI log.
// Node built-ins only. Never throws, always exits 0.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || '.lighthouseci';
const out = [];
const say = (s = '') => out.push(s);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ms = (v) => (num(v) === null ? 'n/a' : `${Math.round(v)}ms`);
const kb = (v) => (num(v) === null ? 'n/a' : `${(v / 1024).toFixed(1)}KB`);
const trim = (s, n = 110) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 3) + '...' : t;
};
const shortUrl = (u) => {
  const s = String(u ?? '');
  return s.length > 90 ? s.slice(0, 87) + '...' : s;
};

function load(d) {
  let files = [];
  try {
    files = readdirSync(d).filter((f) => /^lhr-.*\.json$/.test(f));
  } catch {
    return [];
  }
  const runs = [];
  for (const f of files) {
    try {
      const j = JSON.parse(readFileSync(join(d, f), 'utf8'));
      if (j && typeof j === 'object') runs.push(j);
    } catch {
      /* skip unreadable file */
    }
  }
  return runs;
}

const lcpOf = (r) => num(r?.audits?.['largest-contentful-paint']?.numericValue) ?? Infinity;

function findNode(a) {
  const items = a?.details?.items;
  if (!Array.isArray(items)) return null;
  for (const it of items) {
    if (it?.node) return it.node;
    const sub = it?.items;
    if (Array.isArray(sub)) {
      for (const s of sub) if (s?.node) return s.node;
    }
  }
  return null;
}

function phases(audits) {
  // Newer: lcp-breakdown-insight; older: subItems on largest-contentful-paint-element.
  const rows = [];
  const collect = (items) => {
    if (!Array.isArray(items)) return;
    for (const it of items) {
      if (it && (it.label || it.phase) && num(it.duration ?? it.timing) !== null) {
        rows.push(`${it.label ?? it.phase}=${ms(it.duration ?? it.timing)}`);
      }
      if (it?.subItems?.items) collect(it.subItems.items);
      if (Array.isArray(it?.items)) collect(it.items);
    }
  };
  collect(audits['lcp-breakdown-insight']?.details?.items);
  if (!rows.length) collect(audits['largest-contentful-paint-element']?.details?.items);
  if (!rows.length) {
    const p = audits['lcp-breakdown-insight']?.details?.parts || audits['lcp-breakdown-insight']?.details?.phases;
    if (Array.isArray(p)) collect(p);
  }
  return rows;
}

function listItems(a, n) {
  const items = a?.details?.items;
  return Array.isArray(items) ? items.slice(0, n) : [];
}

function summarise(url, r) {
  const A = r.audits || {};
  const score = num(r.categories?.performance?.score);
  say(`== ${shortUrl(url)}`);
  say(
    `perf=${score === null ? 'n/a' : score} FCP=${ms(A['first-contentful-paint']?.numericValue)} ` +
      `LCP=${ms(A['largest-contentful-paint']?.numericValue)} ` +
      `CLS=${num(A['cumulative-layout-shift']?.numericValue)?.toFixed(3) ?? 'n/a'} ` +
      `TBT=${ms(A['total-blocking-time']?.numericValue)} bytes=${kb(A['total-byte-weight']?.numericValue)}`
  );

  const node = findNode(A['largest-contentful-paint-element']);
  if (node) {
    say(`LCP element: ${trim(node.selector || node.nodeLabel, 80)}`);
    if (node.snippet) say(`  snippet: ${trim(node.snippet)}`);
  } else say('LCP element: n/a');

  const ph = phases(A);
  say(ph.length ? `LCP phases: ${ph.join(' ')}` : 'LCP phases: n/a');

  const disc = A['lcp-discovery-insight'];
  if (disc) say(`LCP discovery: score=${disc.score ?? 'n/a'} ${trim(disc.displayValue || disc.title, 80)}`);

  const rb = A['render-blocking-insight'] || A['render-blocking-resources'];
  const rbItems = listItems(rb, 6);
  if (rb) {
    say(`Render-blocking (${trim(rb.displayValue || '', 40)}):`);
    if (!rbItems.length) say('  none listed');
    for (const it of rbItems) {
      say(`  ${shortUrl(it.url)} ${kb(it.totalBytes ?? it.transferSize)} wasted=${ms(it.wastedMs ?? it.duration)}`);
    }
  } else say('Render-blocking: audit absent');

  const reqs = listItems(A['network-requests'], 10000)
    .filter((i) => i && num(i.transferSize) !== null)
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, 8);
  say('Largest requests (transfer / resource):');
  if (!reqs.length) say('  n/a');
  for (const q of reqs) say(`  ${kb(q.transferSize)} / ${kb(q.resourceSize)}  ${shortUrl(q.url)}`);

  for (const [id, label] of [
    ['unused-javascript', 'Unused JS'],
    ['unused-css-rules', 'Unused CSS'],
  ]) {
    const a = A[id];
    if (!a) continue;
    const top = listItems(a, 3);
    say(`${label}: ${top.length ? '' : 'none listed'}`.trimEnd());
    for (const it of top) say(`  wasted=${kb(it.wastedBytes)} of ${kb(it.totalBytes)}  ${shortUrl(it.url)}`);
  }
  say();
}

try {
  const runs = load(dir);
  if (!runs.length) {
    say('no lhr files found');
  } else {
    const groups = new Map();
    for (const r of runs) {
      const u = r.finalUrl || r.requestedUrl || 'unknown-url';
      if (!groups.has(u)) groups.set(u, []);
      groups.get(u).push(r);
    }
    say(`Lighthouse summary: ${runs.length} run(s), ${groups.size} URL(s); median run by LCP shown`);
    say();
    for (const [u, rs] of groups) {
      const sorted = [...rs].sort((a, b) => lcpOf(a) - lcpOf(b));
      const median = sorted[Math.floor((sorted.length - 1) / 2)];
      try {
        summarise(u, median);
      } catch (e) {
        say(`summary failed for ${shortUrl(u)}: ${e?.message}`);
      }
    }
  }
} catch (e) {
  say(`lhci-summary error: ${e?.message}`);
}
console.log(out.join('\n'));
process.exit(0);
