// Evaluation entry point: run a pipeline on a sample, score against expert labels, write results.
//
// Run:  npm run eval -- --pipeline b [--file data/sample_400.jsonl] [--limit 10] [--threshold 0.5] [--concurrency 8]
//                                     [--explain-batch 10] [--explain-concurrency 4] [--no-explain]
//       npm run eval -- --pipeline a [--file ...] [--limit 40] [--batch 40] [--concurrency 4]
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
import { type PipelineRun, runA, runB } from "./pipelines.js";
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
const concurrency = Number(flag("concurrency", pipeline === "A" ? "4" : "8"));
const batchSize = Number(flag("batch", "40"));
const explain = pipeline === "B" && !args.includes("--no-explain"); // pipeline B step 3
const explainConcurrency = Number(flag("explain-concurrency", "4"));
// Explanations are output-heavy, so small batches in parallel finish faster than one big batch.
const explainBatch = Number(flag("explain-batch", "10"));
const SWEEP = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

if (pipeline !== "A" && pipeline !== "B") {
  console.error(`Unknown pipeline ${pipeline}. Use --pipeline a or --pipeline b.`);
  process.exit(1);
}

let sentences = loadSentences(file);
if (limit > 0) sentences = sentences.slice(0, limit);
const model = pipeline === "A" ? config.llmModel : config.jevModel;
const models = pipeline === "B" && explain ? `${config.jevModel} + ${config.llmModel} (explanations)` : model;
const setting = pipeline === "A" ? `batch ${batchSize}` : `threshold ${threshold}${explain ? `, explain batch ${explainBatch}` : ", no explanations"}`;
console.log(`pipeline ${pipeline} | ${sentences.length} sentences from ${file} | ${model} | rubric ${RUBRIC_VERSION} | ${setting}`);

// ---------- run ----------
let lastStage = "";
const onProgress = (n: number, stage = "") => {
  if (lastStage && stage !== lastStage) process.stdout.write("\n");
  lastStage = stage;
  process.stdout.write(`\r  ${stage ? `${stage} ` : ""}${n}${stage === "explain" ? " flagged" : `/${sentences.length}`}`);
};
const run: PipelineRun =
  pipeline === "A"
    ? await runA(sentences, { batchSize, concurrency, onProgress })
    : await runB(sentences, {
        threshold,
        concurrency,
        explain: explain ? { batchSize: explainBatch, concurrency: explainConcurrency } : undefined,
        onProgress,
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
// Only Jev gives probabilities, so only pipeline B has a threshold sweep. The LLM returns labels only.
const hasProbs = run.results.some((r) => r.probs);
const sweep = (hasProbs ? SWEEP : []).map((t) => {
  const s = asScored(t);
  return { t, micro: micro(perCategory(s, CATEGORIES)), sentence: sentenceLevel(s) };
});

const n = sentences.length;
const per100Cost = (run.cost / n) * 100;
const per100Sec = (run.wallMs / 1000 / n) * 100;

// ---------- pipeline B step 3: stages + explanation stats ----------
const stageTable = run.stages
  ? `## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
${run.stages.map((st) => `| ${st.name} | ${st.items} | ${st.calls} | ${st.failures} | $${st.cost.toFixed(6)} | ${(st.wallMs / 1000).toFixed(1)} s |`).join("\n")}
| **total** | | ${run.calls} | | **$${run.cost.toFixed(6)}** | **${(run.wallMs / 1000).toFixed(1)} s** |
`
  : "";

// The LLM's agree/disagree is recorded only; labels stay Jev's. This shows what an LLM veto WOULD do.
const explained = run.results.filter((r) => r.llmAgrees !== undefined);
const vetoAnalysis = (() => {
  if (!explained.length) return "";
  const count = (agrees: boolean, unfair: boolean) =>
    explained.filter((r) => r.llmAgrees === agrees && r.expert.length > 0 === unfair).length;
  const vetoed = new Set(explained.filter((r) => !r.llmAgrees).map((r) => r.id));
  const v = sentenceLevel(scored.map((r) => (vetoed.has(r.id) ? { ...r, predicted: [] } : r)));
  const pr = (s: Scores) => `P ${s.precision.toFixed(2)}, R ${s.recall.toFixed(2)}, F1 ${s.f1.toFixed(2)}, F2 ${s.f2.toFixed(2)}`;
  return `## Explanations (step 3)

${explained.length} of ${run.stages?.[1]?.items ?? 0} flagged sentences explained.

The LLM was also asked whether it agrees a flagged category applies. Labels were **not** changed; this shows what an LLM veto would do:

| | expert: unfair | expert: fair |
|---|---|---|
| LLM agrees | ${count(true, true)} | ${count(true, false)} |
| LLM disagrees (would veto) | ${count(false, true)} | ${count(false, false)} |

Sentence level with the veto: ${pr(v)} (without: ${pr(sent)}).
`;
})();

// ---------- write ----------
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = `results/${stamp}_${pipeline}_${model.replace(/\W+/g, "-")}${limit ? `_limit${limit}` : ""}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/raw.jsonl`, run.results.map((r) => JSON.stringify(r)).join("\n") + "\n");

const csvRow = (scope: string, thr: number, s: Scores) =>
  [scope, thr, s.support, s.tp, s.fp, s.fn, s.tn, s.precision.toFixed(4), s.recall.toFixed(4), s.f1.toFixed(4), s.f2.toFixed(4)].join(",");
const csv = [
  "scope,threshold,support,tp,fp,fn,tn,precision,recall,f1,f2",
  ...CATEGORIES.map((c) => csvRow(c, hasProbs ? threshold : NaN, cats[c]!)),
  csvRow("micro", hasProbs ? threshold : NaN, mic),
  csvRow("sentence", hasProbs ? threshold : NaN, sent),
  ...sweep.flatMap((s) => [csvRow("sweep_micro", s.t, s.micro), csvRow("sweep_sentence", s.t, s.sentence)]),
];
writeFileSync(`${dir}/metrics.csv`, csv.join("\n") + "\n");

const f = (x: number) => x.toFixed(2);
const row = (name: string, s: Scores) => `| ${name} | ${s.support} | ${s.tp} | ${s.fp} | ${s.fn} | ${f(s.precision)} | ${f(s.recall)} | ${f(s.f1)} | ${f(s.f2)} |`;
const summary = `# Pipeline ${pipeline} — ${file}${limit ? ` (first ${limit})` : ""}

| | |
|---|---|
| Date | ${new Date().toISOString()} |
| Model | ${models} |
| Rubric | ${RUBRIC_VERSION} |
| Sentences | ${n} (${sentences.filter((s) => s.categories.length).length} unfair) |
| ${pipeline === "A" ? "Batch size" : "Threshold"} | ${pipeline === "A" ? `${batchSize} consecutive sentences per call` : `${threshold}${explain ? ` · explanations: ${explainBatch} flagged sentences per call` : " · no explanations"}`} |
| Wall-clock | ${(run.wallMs / 1000).toFixed(1)} s (concurrency ${concurrency}${explain ? `, explain ${explainConcurrency}` : ""}) → **${per100Sec.toFixed(1)} s per 100 sentences** |
| Cost | $${run.cost.toFixed(6)} → **$${per100Cost.toFixed(5)} per 100**, $${(per100Cost * 10).toFixed(4)} per 1k, $${(per100Cost * 1000).toFixed(2)} per 100k |
| Reliability | ${run.failures} of ${n} sentences without a usable answer (${f((run.failures / n) * 100)}%) · ${run.calls} API calls · ${retryCount} HTTP retries${run.malformed !== undefined ? ` · ${run.malformed} malformed replies` : ""} |

## Accuracy${hasProbs ? ` @ ${threshold}` : ""}

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
${CATEGORIES.map((c) => row(c, cats[c]!)).join("\n")}
| **micro** | ${mic.support} | ${mic.tp} | ${mic.fp} | ${mic.fn} | ${f(mic.precision)} | ${f(mic.recall)} | **${f(mic.f1)}** | ${f(mic.f2)} |
| **sentence (any category)** | ${sent.support} | ${sent.tp} | ${sent.fp} | ${sent.fn} | ${f(sent.precision)} | ${f(sent.recall)} | **${f(sent.f1)}** | ${f(sent.f2)} |

Macro-F1: ${f(macroF1(cats))} · Exact label-set match: ${f(exactMatch(scored) * 100)}%

${stageTable}
${vetoAnalysis}
${
  hasProbs
    ? `## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 |
|---|---|---|---|---|---|---|---|
${sweep.map((s) => `| ${s.t} | ${f(s.micro.precision)} | ${f(s.micro.recall)} | ${f(s.micro.f1)} | ${f(s.sentence.precision)} | ${f(s.sentence.recall)} | ${f(s.sentence.f1)} | ${f(s.sentence.f2)} |`).join("\n")}
`
    : "No threshold sweep: the LLM returns labels, not probabilities.\n"
}`;
writeFileSync(`${dir}/summary.md`, summary);

console.log(summary);
console.log(`saved ${dir}/`);
if (run.failures) console.log(`first error: ${run.results.find((r) => r.failed)?.error}`);
const explainErr = run.results.find((r) => r.explainError);
if (explainErr) console.log(`first explanation error: ${explainErr.explainError}`);
