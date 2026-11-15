// Consistency across repeated runs of the same pipeline on the same sentences. No API calls: reads saved raw.jsonl.
//
// Run:  npm run consistency -- <resultDir1> <resultDir2> <resultDir3> [--out results/step7/consistency_B.md]
//
// Reports, per pipeline:
//   - % of sentences whose predicted label set differs between any two runs
//   - % whose "flagged at all" (sentence-level) answer differs
//   - accuracy of each run (sentence P/R/F1) and the spread
//   - Jev only: probability spread per sentence × category, and how many sit near the threshold
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { flagged } from "../src/jev.js";
import { sentenceLevel, type Scored } from "../src/metrics.js";
import type { SentenceResult } from "../src/pipelines.js";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : undefined;
const dirs = args;
if (dirs.length < 2) {
  console.error("Usage: npm run consistency -- <dir1> <dir2> [dir3 ...] [--out file.md]");
  process.exit(1);
}

const runs = dirs.map((d) =>
  readFileSync(`${d}/raw.jsonl`, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as SentenceResult),
);
const ids = runs[0]!.map((r) => r.id);
for (const run of runs) {
  if (run.length !== ids.length || run.some((r, i) => r.id !== ids[i])) throw new Error("runs are not on the same sentences");
}
const hasProbs = runs[0]!.some((r) => r.probs);
const key = (labels: string[]) => [...labels].sort().join(",");

/** Label sets per run for one threshold (Jev) or as returned (LLM). */
function labelsAt(t?: number): string[][][] {
  return runs.map((run) => run.map((r) => (t !== undefined && r.probs ? flagged(r.probs, t) : r.failed ? [] : r.predicted)));
}

function stability(t?: number) {
  const sets = labelsAt(t);
  let labelChanged = 0;
  let flagChanged = 0;
  const flips: string[] = [];
  ids.forEach((id, i) => {
    const perRun = sets.map((s) => s[i]!);
    if (new Set(perRun.map(key)).size > 1) {
      labelChanged++;
      flips.push(`${id}: ${perRun.map((l) => `[${l.join(", ") || "-"}]`).join(" vs ")}`);
    }
    if (new Set(perRun.map((l) => l.length > 0)).size > 1) flagChanged++;
  });
  const acc = sets.map((s) =>
    sentenceLevel(runs[0]!.map((r, i): Scored => ({ id: r.id, expert: r.expert, predicted: s[i]! }))),
  );
  return { labelChanged, flagChanged, flips, acc };
}

const n = ids.length;
const pct = (x: number) => `${((x / n) * 100).toFixed(2)}%`;
const f = (x: number) => x.toFixed(3);
const pipeline = dirs[0]!.match(/_(A|B)_/)?.[1] ?? "?";

const section = (title: string, s: ReturnType<typeof stability>) => `### ${title}

| | |
|---|---|
| Sentences whose label set changed between runs | **${s.labelChanged} of ${n} (${pct(s.labelChanged)})** |
| Sentences whose flagged / not-flagged answer changed | ${s.flagChanged} of ${n} (${pct(s.flagChanged)}) |

| run | sentence P | sentence R | sentence F1 |
|---|---|---|---|
${s.acc.map((a, i) => `| ${i + 1} | ${f(a.precision)} | ${f(a.recall)} | ${f(a.f1)} |`).join("\n")}
| spread (max − min) | ${f(Math.max(...s.acc.map((a) => a.precision)) - Math.min(...s.acc.map((a) => a.precision)))} | ${f(Math.max(...s.acc.map((a) => a.recall)) - Math.min(...s.acc.map((a) => a.recall)))} | ${f(Math.max(...s.acc.map((a) => a.f1)) - Math.min(...s.acc.map((a) => a.f1)))} |

${s.flips.length ? `Changed sentences${s.flips.length > 15 ? " (first 15)" : ""}:\n${s.flips.slice(0, 15).map((x) => `- ${x}`).join("\n")}` : "No sentence changed."}
`;

let md = `# Consistency — pipeline ${pipeline}, ${runs.length} runs, ${n} sentences

Runs: ${dirs.map((d) => `\`${d}\``).join(", ")}

`;

if (hasProbs) {
  for (const t of [0.5, 0.6]) md += section(`Jev labels at threshold ${t}`, stability(t)) + "\n";
  // Probability spread: for each sentence × category, max − min probability across runs.
  const spreads: number[] = [];
  const near: Record<string, number> = { "0.5": 0, "0.6": 0 };
  ids.forEach((_, i) => {
    for (const c of Object.keys(runs[0]![i]!.probs ?? {})) {
      const ps = runs.map((run) => run[i]!.probs![c]!);
      spreads.push(Math.max(...ps) - Math.min(...ps));
      for (const t of [0.5, 0.6]) if (ps.some((p) => Math.abs(p - t) <= 0.05)) near[String(t)]!++;
    }
  });
  spreads.sort((a, b) => a - b);
  const q = (p: number) => spreads[Math.min(spreads.length - 1, Math.floor(p * spreads.length))]!;
  md += `### Jev probability spread across runs (${spreads.length} sentence × category pairs)

| identical | median | 95th percentile | 99th percentile | max |
|---|---|---|---|---|
| ${((spreads.filter((s) => s === 0).length / spreads.length) * 100).toFixed(1)}% | ${f(q(0.5))} | ${f(q(0.95))} | ${f(q(0.99))} | ${f(spreads.at(-1)!)} |

Pairs with a probability within ±0.05 of the threshold in any run: ${near["0.5"]} at 0.5, ${near["0.6"]} at 0.6. These are the only ones that can plausibly flip.
`;
} else {
  md += section("LLM labels", stability());
}

console.log(md);
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, md);
  console.log(`saved ${out}`);
}
