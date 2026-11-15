// Test one rubric question against expert-labelled sentences, optionally side by side with a candidate rewording.
//
// Run:  npm run rubric-check -- <category> [regex] [--file data/sample_400.jsonl] [--threshold 0.5]
//   e.g. npm run rubric-check -- unilateral_change "notice|notify"
//
// If src/rubric.candidates.json has an entry for <category>, both versions are asked in the SAME Jev call
// (as "<category>__current" and "<category>__candidate"), so the comparison is on identical input.
// Prints each sentence with expert label + probabilities, marks mistakes, then a confusion summary.
import { existsSync, readFileSync } from "node:fs";
import { callJev, type JevQuestion } from "../src/openrouter.js";
import rubricFile from "../src/rubric.json" with { type: "json" };
import type { Sentence } from "../src/data.js";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1]! : fallback;
};
const file = flag("file", "data/sample_400.jsonl");
const threshold = Number(flag("threshold", "0.5"));
const [category, pattern] = args;

const rubric = rubricFile as unknown as Record<string, JevQuestion>;
if (!category || !rubric[category]) {
  console.log(`Usage: npm run rubric-check -- <${Object.keys(rubric).filter((k) => !k.startsWith("_")).join("|")}> [regex]`);
  process.exit(1);
}

const candidatesPath = "src/rubric.candidates.json";
// A candidate entry is either one question, or a map of named variants: {"v1": {...}, "v2": {...}}.
type CandidateEntry = JevQuestion | Record<string, JevQuestion>;
const candidates: Record<string, CandidateEntry> = existsSync(candidatesPath)
  ? JSON.parse(readFileSync(candidatesPath, "utf8"))
  : {};

const variants: Record<string, JevQuestion> = { current: rubric[category]! };
const entry = candidates[category];
if (entry && "type" in entry) variants.candidate = entry as JevQuestion;
else if (entry) Object.assign(variants, entry);
const names = Object.keys(variants);

const rows: Sentence[] = readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
const re = pattern ? new RegExp(pattern, "i") : null;
const selected = re ? rows.filter((r) => re.test(r.text)) : rows;
console.log(`${category}: ${selected.length} sentences from ${file}${re ? ` matching /${pattern}/i` : ""}, variants: ${names.join(" vs ")}, threshold ${threshold}\n`);

// Small concurrency pool (no dependency needed).
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

let cost = 0;
const results = await pool(selected, 8, async (s) => {
  const questions = Object.fromEntries(names.map((n) => [`${category}__${n}`, variants[n]!]));
  const { data } = await callJev({ state: { clause: s.text }, questions });
  cost += data.usage.cost ?? 0;
  const probs = names.map((n) => {
    const a = data.answers[`${category}__${n}`];
    return a && a.type === "noul" ? a.noul : NaN;
  });
  return { s, expert: s.categories.includes(category), probs };
});

const tally = names.map(() => ({ tp: 0, fp: 0, fn: 0, tn: 0 }));
for (const { s, expert, probs } of results) {
  const cells = probs.map((p, i) => {
    const predicted = p >= threshold;
    const t = tally[i]!;
    if (predicted && expert) t.tp++;
    else if (predicted && !expert) t.fp++;
    else if (!predicted && expert) t.fn++;
    else t.tn++;
    return `${p.toFixed(2)}${predicted === expert ? " " : "✗"}`;
  });
  const others = s.categories.filter((c) => c !== category);
  const label = (expert ? "YES" : "no ") + (others.length ? ` (+${others.join(",")})` : "");
  console.log(`${s.id}  expert=${label.padEnd(5)}  ${names.map((n, i) => `${n}=${cells[i]}`).join("  ")}`);
  console.log(`         ${s.text.length > 160 ? s.text.slice(0, 157) + "..." : s.text}`);
}

// F-beta: beta=1 balances precision/recall; beta=2 weights recall 2x (missing an unfair clause is worse than a false alarm).
const fBeta = (p: number, r: number, beta: number) => (p + r ? ((1 + beta ** 2) * p * r) / (beta ** 2 * p + r) : 0);

console.log("\n          TP  FP  FN  TN   precision  recall  F1    F2");
names.forEach((n, i) => {
  const { tp, fp, fn, tn } = tally[i]!;
  const p = tp + fp ? tp / (tp + fp) : 0;
  const r = tp + fn ? tp / (tp + fn) : 0;
  console.log(
    `${n.padEnd(9)} ${[tp, fp, fn, tn].map((x) => String(x).padStart(3)).join(" ")}   ${p.toFixed(2).padStart(9)}  ${r.toFixed(2).padStart(6)}  ${fBeta(p, r, 1).toFixed(2)}  ${fBeta(p, r, 2).toFixed(2)}`,
  );
});

// Threshold sweep from the same answers (no extra calls): shows the sensitivity trade-off a UI slider would expose.
console.log("\nrecall / precision by threshold:");
console.log(`${"".padEnd(9)} ${[0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((t) => `  @${t.toFixed(1)}    `).join("")}`);
names.forEach((n, i) => {
  const cells = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((t) => {
    let tp = 0, fp = 0, fn = 0;
    for (const { expert, probs } of results) {
      const pred = probs[i]! >= t;
      if (pred && expert) tp++;
      else if (pred) fp++;
      else if (expert) fn++;
    }
    const r = tp + fn ? tp / (tp + fn) : 0;
    const p = tp + fp ? tp / (tp + fp) : 0;
    return `${r.toFixed(2)}/${p.toFixed(2)}  `;
  });
  console.log(`${n.padEnd(9)} ${cells.join("")}`);
});
console.log(`\ncost: $${cost.toFixed(6)}  (✗ = disagrees with expert at threshold ${threshold})`);
