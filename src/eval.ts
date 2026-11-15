// Evaluation entry point: run a pipeline on a sample, score against expert labels, write results.
//
// Run:  npm run eval -- --pipeline b [--file data/sample_400.jsonl] [--limit 10] [--threshold 0.5] [--concurrency 8]
//
// Writes results/<timestamp>_<pipeline>_<model>/:
//   raw.jsonl     one line per sentence: expert labels, prediction, (Jev) probabilities, errors
//   metrics.csv   per-category + micro + sentence-level rows (+ threshold sweep for B)
//   summary.md    human-readable table with run info, cost and latency
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "./config.js";
import { loadSentences } from "./data.js";
import { flagged } from "./jev.js";
import { exactMatch, macroF1, micro, perCategory, type Scored, type Scores, sentenceLevel } from "./metrics.js";
import { retryCount } from "./openrouter.js";
import { type PipelineRun, runB } from "./pipelines.js";
import { CATEGORIES, RUBRIC_VERSION } from "./rubric.js";

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]! : fallback;
};
const pipeline = flag("pipeline", "b").toUpperCase();
const file = flag("file", "data/sample_400.jsonl");
const limit = Number(flag("limit", "0"));
const threshold = Number(flag("threshold", "0.5"));
const concurrency = Number(flag("concurrency", "8"));
const SWEEP = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

if (pipeline !== "B") {
  console.error(`Pipeline ${pipeline} not implemented yet (step 5). Use --pipeline b.`);
  process.exit(1);
}

let sentences = loadSentences(file);
if (limit > 0) sentences = sentences.slice(0, limit);
const model = config.jevModel;
console.log(`pipeline ${pipeline} | ${sentences.length} sentences from ${file} | ${model} | rubric ${RUBRIC_VERSION} | threshold ${threshold}`);

// ---------- run ----------
const run: PipelineRun = await runB(sentences, {
  threshold,
  concurrency,
  onProgress: (n) => process.stdout.write(`\r  ${n}/${sentences.length}`),
});
console.log();

// ---------- score ----------
const asScored = (t: number): Scored[] =>
  run.results.map((r) => ({
    id: r.id,
    expert: r.expert,
    predicted: r.probs ? flagged(r.probs, t) : r.predicted,
    failed: r.failed,
  }));
const scored = asScored(threshold);
const cats = perCategory(scored, CATEGORIES);
const mic = micro(cats);
const sent = sentenceLevel(scored);
const sweep = SWEEP.map((t) => {
  const s = asScored(t);
  return { t, micro: micro(perCategory(s, CATEGORIES)), sentence: sentenceLevel(s) };
});

const n = sentences.length;
const per100Cost = (run.cost / n) * 100;
const per100Sec = (run.wallMs / 1000 / n) * 100;

// ---------- write ----------
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = `results/${stamp}_${pipeline}_${model.replace(/\W+/g, "-")}${limit ? `_limit${limit}` : ""}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/raw.jsonl`, run.results.map((r) => JSON.stringify(r)).join("\n") + "\n");

const csvRow = (scope: string, thr: number, s: Scores) =>
  [scope, thr, s.support, s.tp, s.fp, s.fn, s.tn, s.precision.toFixed(4), s.recall.toFixed(4), s.f1.toFixed(4), s.f2.toFixed(4)].join(",");
const csv = [
  "scope,threshold,support,tp,fp,fn,tn,precision,recall,f1,f2",
  ...CATEGORIES.map((c) => csvRow(c, threshold, cats[c]!)),
  csvRow("micro", threshold, mic),
  csvRow("sentence", threshold, sent),
  ...sweep.flatMap((s) => [csvRow("sweep_micro", s.t, s.micro), csvRow("sweep_sentence", s.t, s.sentence)]),
];
writeFileSync(`${dir}/metrics.csv`, csv.join("\n") + "\n");

const f = (x: number) => x.toFixed(2);
const row = (name: string, s: Scores) => `| ${name} | ${s.support} | ${s.tp} | ${s.fp} | ${s.fn} | ${f(s.precision)} | ${f(s.recall)} | ${f(s.f1)} | ${f(s.f2)} |`;
const summary = `# Pipeline ${pipeline} — ${file}${limit ? ` (first ${limit})` : ""}

| | |
|---|---|
| Date | ${new Date().toISOString()} |
| Model | ${model} |
| Rubric | ${RUBRIC_VERSION} |
| Sentences | ${n} (${sentences.filter((s) => s.categories.length).length} unfair) |
| Threshold | ${threshold} |
| Wall-clock | ${(run.wallMs / 1000).toFixed(1)} s (concurrency ${concurrency}) → **${per100Sec.toFixed(1)} s per 100 sentences** |
| Cost | $${run.cost.toFixed(6)} → **$${per100Cost.toFixed(5)} per 100**, $${(per100Cost * 10).toFixed(4)} per 1k, $${(per100Cost * 1000).toFixed(2)} per 100k |
| Reliability | ${run.failures} failed of ${run.calls} calls (${f((run.failures / run.calls) * 100)}%), ${retryCount} retries |

## Accuracy @ ${threshold}

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
${CATEGORIES.map((c) => row(c, cats[c]!)).join("\n")}
| **micro** | ${mic.support} | ${mic.tp} | ${mic.fp} | ${mic.fn} | ${f(mic.precision)} | ${f(mic.recall)} | **${f(mic.f1)}** | ${f(mic.f2)} |
| **sentence (any category)** | ${sent.support} | ${sent.tp} | ${sent.fp} | ${sent.fn} | ${f(sent.precision)} | ${f(sent.recall)} | **${f(sent.f1)}** | ${f(sent.f2)} |

Macro-F1: ${f(macroF1(cats))} · Exact label-set match: ${f(exactMatch(scored) * 100)}%

## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 |
|---|---|---|---|---|---|---|---|
${sweep.map((s) => `| ${s.t} | ${f(s.micro.precision)} | ${f(s.micro.recall)} | ${f(s.micro.f1)} | ${f(s.sentence.precision)} | ${f(s.sentence.recall)} | ${f(s.sentence.f1)} | ${f(s.sentence.f2)} |`).join("\n")}
`;
writeFileSync(`${dir}/summary.md`, summary);

console.log(summary);
console.log(`saved ${dir}/`);
if (run.failures) console.log(`first error: ${run.results.find((r) => r.failed)?.error}`);
