// Build a deterministic evaluation sample: ALL unfair sentences + a seeded random set of fair ones.
// Run:  npm run make-sample                      -> data/sample_400.jsonl (172 unfair + 228 fair)
//       npm run make-sample -- 600 7             -> size 600, seed 7
//
// Rows are re-sorted by original index so batches keep document order (the LLM sees neighbours).
import { readFileSync, writeFileSync } from "node:fs";
import type { Sentence } from "./inspect-data.js";

const size = Number(process.argv[2] ?? 400);
const seed = Number(process.argv[3] ?? 42);

// mulberry32: tiny seeded PRNG so the sample is reproducible
function rng(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows: Sentence[] = readFileSync("data/unfair_tos_test.jsonl", "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));

const unfair = rows.filter((r) => r.labels.length > 0);
const fair = rows.filter((r) => r.labels.length === 0);
if (size < unfair.length) throw new Error(`size ${size} < ${unfair.length} unfair sentences`);

// Fisher-Yates shuffle of the fair sentences, then take what's needed.
const random = rng(seed);
const shuffled = [...fair];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
}
const sample = [...unfair, ...shuffled.slice(0, size - unfair.length)].sort((a, b) => a.idx - b.idx);

const file = `data/sample_${size}.jsonl`;
writeFileSync(file, sample.map((r) => JSON.stringify(r)).join("\n") + "\n");

const counts = new Map<string, number>();
for (const r of sample) for (const c of r.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
console.log(`${file}: ${sample.length} sentences (${unfair.length} unfair, ${sample.length - unfair.length} fair), seed ${seed}`);
for (const [c, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(24)} ${n}`);
