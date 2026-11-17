// Re-explain the flagged sentences of a recorded pipeline B run with another LLM, keeping Jev's flags as they are.
// Same prompt (EXPLAIN_PROMPT), validation, batch size and concurrency as the eval's step 3; only the model changes.
//
//   EXPLAIN_MODEL=anthropic/claude-haiku-5.5 npm run reexplain -- <B run dir> [--batch 10] [--concurrency 4]
//
// Writes results/<timestamp>_B-explain_<model>/ with raw.jsonl ({id, explanation, llmAgrees}) and summary.md,
// whose "llm-explain" stage row has the same format as the eval's, so build-replay can read it (--explain <dir>).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { config } from "../src/config.js";
import { llmExplainBatch } from "../src/llm.js";
import { pool } from "../src/pool.js";
import { RUBRIC_VERSION } from "../src/rubric.js";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { batch: { type: "string", default: "10" }, concurrency: { type: "string", default: "4" } },
});
const bDir = positionals[0];
if (!bDir) throw new Error("usage: npm run reexplain -- <B run dir> [--batch 10] [--concurrency 4]");
const batchSize = Number(args.batch);
const concurrency = Number(args.concurrency);
const model = config.explainModel;

type BRow = { id: string; text: string; expert: string[]; predicted: string[]; explanation?: string };
const rows = readFileSync(join(bDir, "raw.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as BRow);
const flagged = rows.filter((r) => r.predicted.length > 0); // document order, exactly the sentences B explained

const batches: BRow[][] = [];
for (let i = 0; i < flagged.length; i += batchSize) batches.push(flagged.slice(i, i + batchSize));

console.log(`Re-explaining ${flagged.length} flagged sentences from ${bDir} with ${model} (${batches.length} calls, ${concurrency} in flight)…`);
const out = new Map<string, { explanation: string; llmAgrees: boolean }>();
const errors = new Map<string, string>();
let cost = 0;
let calls = 0;
let malformed = 0;
const started = performance.now();
await pool(batches, concurrency, async (batch) => {
  try {
    const r = await llmExplainBatch(batch.map((s) => ({ id: s.id, text: s.text, categories: s.predicted })), { model });
    cost += r.cost;
    calls += r.attempts;
    malformed += r.malformed;
    for (const s of batch) {
      const e = r.labels.get(s.id);
      if (e) out.set(s.id, { explanation: e.explanation, llmAgrees: e.agree });
      else errors.set(s.id, r.error ?? "missing from reply");
    }
  } catch (err) {
    calls++;
    for (const s of batch) errors.set(s.id, String(err).slice(0, 300));
  }
});
const seconds = (performance.now() - started) / 1000;

// ---------- write results ----------
const stamp = new Date().toISOString().replace(/:/g, "-").replace(/\.\d+Z$/, "");
const dir = join("results", `${stamp}_B-explain_${model.split("/").pop()!.replaceAll(".", "-")}`);
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, "raw.jsonl"),
  flagged.map((s) => JSON.stringify({ id: s.id, ...(out.get(s.id) ?? { explainError: errors.get(s.id) }) })).join("\n") + "\n",
);

const count = (agree: boolean, unfair: boolean) =>
  flagged.filter((s) => out.get(s.id)?.llmAgrees === agree && s.expert.length > 0 === unfair).length;
const lengths = [...out.values()].map((e) => e.explanation.length);
const meanLen = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;
const oldLengths = flagged.filter((s) => s.explanation).map((s) => s.explanation!.length);
const oldMeanLen = oldLengths.length ? Math.round(oldLengths.reduce((a, b) => a + b, 0) / oldLengths.length) : 0;

const summary = `# Re-explanation of pipeline B flags — ${bDir}

| | |
|---|---|
| Date | ${new Date().toISOString()} |
| Model | ${model} (explanations only; Jev's flags unchanged) |
| Source run | \`${bDir}\` |
| Rubric | ${RUBRIC_VERSION} |
| Flagged sentences | ${flagged.length} |
| Settings | ${batchSize} flagged sentences per call, concurrency ${concurrency} |
| Reliability | ${errors.size} of ${flagged.length} without an explanation · ${calls} API calls · ${malformed} malformed replies |
| Mean explanation length | ${meanLen} characters (source run: ${oldMeanLen}) |

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| llm-explain | ${flagged.length} | ${calls} | ${errors.size} | $${cost.toFixed(6)} | ${seconds.toFixed(1)} s |

Cost per flag: $${(cost / Math.max(1, flagged.length)).toFixed(6)}.

## Would the LLM veto the flag? (labels are not changed)

| | expert: unfair | expert: fair |
|---|---|---|
| LLM agrees | ${count(true, true)} | ${count(true, false)} |
| LLM disagrees | ${count(false, true)} | ${count(false, false)} |
`;
writeFileSync(join(dir, "summary.md"), summary);
console.log(summary);
console.log(`saved ${dir}/`);
