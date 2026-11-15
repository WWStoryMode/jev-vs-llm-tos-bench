// Ask ALL 8 rubric questions in one Jev call per sentence (as pipeline B will) and score every category.
// Run:  npm run rubric-eval -- [--file data/val_sample_530.jsonl] [--threshold 0.5]
//
// Prints per-category precision/recall/F1/F2 + a threshold sweep, and sentence-level scores
// ("is the sentence flagged by ANY category?"), which is what protects a user.
// Raw probabilities are saved to results/rubric-eval/ so thresholds can be re-scored without new calls.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { callJev, type JevQuestion } from "../src/openrouter.js";
import { config } from "../src/config.js";
import rubricFile from "../src/rubric.json" with { type: "json" };
import type { Sentence } from "../src/data.js";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1]! : fallback;
};
const file = flag("file", "data/val_sample_530.jsonl");
const threshold = Number(flag("threshold", "0.5"));
const SWEEP = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

const rubric = Object.fromEntries(Object.entries(rubricFile).filter(([k]) => !k.startsWith("_"))) as Record<string, JevQuestion>;
const cats = Object.keys(rubric);

const rows: Sentence[] = readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
console.log(`rubric-eval: ${rows.length} sentences from ${file}, ${cats.length} questions per call, model ${config.jevModel}\n`);

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
let done = 0;
const started = performance.now();
const results = await pool(rows, 8, async (s) => {
  const { data } = await callJev({ state: { clause: s.text }, questions: rubric });
  cost += data.usage.cost ?? 0;
  process.stdout.write(`\r${++done}/${rows.length}`);
  const probs = Object.fromEntries(
    cats.map((c) => {
      const a = data.answers[c];
      return [c, a && a.type === "noul" ? a.noul : NaN];
    }),
  );
  return { id: s.id, text: s.text, expert: s.categories, probs };
});
const seconds = (performance.now() - started) / 1000;
console.log("\n");

type Tally = { tp: number; fp: number; fn: number; tn: number };
const score = (t: Tally) => {
  const p = t.tp + t.fp ? t.tp / (t.tp + t.fp) : 0;
  const r = t.tp + t.fn ? t.tp / (t.tp + t.fn) : 0;
  const f = (b: number) => (p + r ? ((1 + b * b) * p * r) / (b * b * p + r) : 0);
  return { p, r, f1: f(1), f2: f(2) };
};
const tallyFor = (pred: (x: (typeof results)[number]) => boolean, truth: (x: (typeof results)[number]) => boolean) => {
  const t: Tally = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const x of results) {
    const p = pred(x), e = truth(x);
    if (p && e) t.tp++;
    else if (p) t.fp++;
    else if (e) t.fn++;
    else t.tn++;
  }
  return t;
};
const fmt = (n: number) => n.toFixed(2);

console.log(`per category @${threshold}`);
console.log(`${"category".padEnd(24)} pos   TP  FP  FN   prec  recall  F1    F2`);
const micro: Tally = { tp: 0, fp: 0, fn: 0, tn: 0 };
for (const c of cats) {
  const t = tallyFor((x) => x.probs[c]! >= threshold, (x) => x.expert.includes(c));
  (Object.keys(micro) as (keyof Tally)[]).forEach((k) => (micro[k] += t[k]));
  const s = score(t);
  console.log(`${c.padEnd(24)} ${String(t.tp + t.fn).padStart(3)}  ${[t.tp, t.fp, t.fn].map((n) => String(n).padStart(3)).join(" ")}   ${fmt(s.p)}  ${fmt(s.r)}   ${fmt(s.f1)}  ${fmt(s.f2)}`);
}
const m = score(micro);
console.log(`${"micro (all categories)".padEnd(24)} ${String(micro.tp + micro.fn).padStart(3)}  ${[micro.tp, micro.fp, micro.fn].map((n) => String(n).padStart(3)).join(" ")}   ${fmt(m.p)}  ${fmt(m.r)}   ${fmt(m.f1)}  ${fmt(m.f2)}`);

console.log(`\nsentence level: flagged if ANY category >= threshold (what a user sees)`);
console.log(`threshold   TP  FP  FN   prec  recall  F1    F2`);
for (const th of SWEEP) {
  const t = tallyFor((x) => cats.some((c) => x.probs[c]! >= th), (x) => x.expert.length > 0);
  const s = score(t);
  console.log(`  @${th.toFixed(1)}    ${[t.tp, t.fp, t.fn].map((n) => String(n).padStart(3)).join(" ")}   ${fmt(s.p)}  ${fmt(s.r)}   ${fmt(s.f1)}  ${fmt(s.f2)}`);
}

console.log(`\nrecall / precision by threshold, per category`);
console.log(`${"".padEnd(24)} ${SWEEP.map((t) => `  @${t.toFixed(1)}    `).join("")}`);
for (const c of cats) {
  const cells = SWEEP.map((th) => {
    const s = score(tallyFor((x) => x.probs[c]! >= th, (x) => x.expert.includes(c)));
    return `${fmt(s.r)}/${fmt(s.p)}  `;
  });
  console.log(`${c.padEnd(24)} ${cells.join("")}`);
}

mkdirSync("results/rubric-eval", { recursive: true });
const out = `results/rubric-eval/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(out, JSON.stringify({ file, model: config.jevModel, rubric, results }, null, 2));
console.log(`\n${rows.length} sentences in ${seconds.toFixed(1)}s, cost $${cost.toFixed(6)}  ->  saved ${out}`);
