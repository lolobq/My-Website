// Usage: node tests/require-node.mjs <major> <label>. Exits 1 with a clear message on older Node.
const [min = "20", label = "this script"] = process.argv.slice(2);
const major = Number(process.versions.node.split(".")[0]);
if (major < Number(min)) {
  console.error(`${label} needs Node >= ${min} (found ${process.versions.node}). CI uses Node 22.`);
  process.exit(1);
}
