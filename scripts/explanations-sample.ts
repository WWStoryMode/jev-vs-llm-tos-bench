// Build a BLIND sample of explanations for manual 1–5 rating. No API calls: reads saved raw.jsonl.
//
// Run:  npm run explanations-sample -- <A resultDir> <B resultDir> [--n 20] [--fair 5] [--seed 7] [--out results/step7]
//
// Picks sentences where BOTH pipelines wrote an explanation: mostly expert-unfair ones, plus a few
// expert-fair ones (shared false alarms). For each row the two explanations are put in random order as
// explanation_1 / explanation_2, so the rater doesn't know which pipeline wrote which.
// The answer key goes to a separate file: open it only after rating.
//
// Rating guide (1–5): is it correct about the sentence, specific (names what the provider can do),
// and understandable for a consumer?  1 = wrong or misleading · 3 = correct but vague · 5 = correct, specific, clear.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { SentenceResult } from "../src/pipelines.js";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1]! : fallback;
};
const total = Number(flag("n", "20"));
const fairCount = Number(flag("fair", "5"));
const seed = Number(flag("seed", "7"));
const outDir = flag("out", "results/step7");
const [dirA, dirB] = args;
if (!dirA || !dirB) {
  console.error("Usage: npm run explanations-sample -- <A resultDir> <B resultDir> [--n 20] [--fair 5]");
  process.exit(1);
}

const load = (d: string) =>
  new Map(
    readFileSync(`${d}/raw.jsonl`, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as SentenceResult)
      .map((r) => [r.id, r]),
  );
const A = load(dirA);
const B = load(dirB);

// Same seeded shuffle as make-sample.ts, so the sample is reproducible.
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(seed);
const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

const both = [...A.values()].filter((a) => a.explanation && B.get(a.id)?.explanation);
const unfair = shuffle(both.filter((r) => r.expert.length > 0)).slice(0, total - fairCount);
const fair = shuffle(both.filter((r) => r.expert.length === 0)).slice(0, fairCount);
const picked = [...unfair, ...fair].sort((x, y) => x.id.localeCompare(y.id));

const csv = (v: string) => `"${v.replace(/"/g, '""')}"`;
const rows = ["id,sentence,expert_labels,explanation_1,explanation_2,rating_1,rating_2,notes"];
const keyRows = ["id,explanation_1,explanation_2,labels_A,labels_B"];
for (const a of picked) {
  const b = B.get(a.id)!;
  const aFirst = rand() < 0.5;
  const [e1, e2] = aFirst ? [a.explanation!, b.explanation!] : [b.explanation!, a.explanation!];
  rows.push([csv(a.id), csv(a.text.trim()), csv(a.expert.join("; ") || "fair"), csv(e1), csv(e2), "", "", ""].join(","));
  keyRows.push([a.id, aFirst ? "A" : "B", aFirst ? "B" : "A", csv(a.predicted.join("; ")), csv(b.predicted.join("; "))].join(","));
}

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/explanations_sample.csv`, rows.join("\n") + "\n");
writeFileSync(`${outDir}/explanations_key.csv`, keyRows.join("\n") + "\n");
console.log(
  `${picked.length} sentences (${unfair.length} expert-unfair, ${fair.length} expert-fair) from ${both.length} explained by both.\n` +
    `Rate: ${outDir}/explanations_sample.csv (fill rating_1, rating_2 with 1–5)\nKey (open after rating): ${outDir}/explanations_key.csv`,
);
