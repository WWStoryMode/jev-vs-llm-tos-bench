// Pipelines produce a common result shape so eval.ts can score and compare them identically.
import type { Sentence } from "./data.js";
import { flagged, jevClassify } from "./jev.js";
import { llmExplainBatch, llmLabelBatch } from "./llm.js";
import { pool } from "./pool.js";

export type SentenceResult = {
  id: string;
  text: string;
  expert: string[];
  predicted: string[];
  probs?: Record<string, number>; // Jev only: raw probabilities, so thresholds can be re-scored offline
  explanation?: string; // LLM explanation (pipeline A: every unfair sentence; pipeline B: every Jev-flagged sentence)
  llmAgrees?: boolean; // pipeline B only: does the LLM agree a flagged category applies? (recorded, labels unchanged)
  explainError?: string; // pipeline B only: explanation step failed for this sentence (labels still valid)
  failed?: boolean;
  error?: string;
};

export type PipelineRun = {
  pipeline: "A" | "B";
  results: SentenceResult[];
  cost: number; // USD, sum of usage.cost
  wallMs: number; // wall-clock for the whole run
  calls: number;
  failures: number; // sentences with no usable prediction
  malformed?: number; // LLM replies that failed JSON/zod/id validation (incl. ones fixed by a retry)
  stages?: Stage[]; // pipeline B: per-stage cost/time (Jev, then LLM explanations)
};

export type Stage = { name: string; cost: number; wallMs: number; calls: number; items: number; failures: number; malformed?: number };

export type PipelineBOptions = {
  threshold: number;
  concurrency: number;
  explain?: { batchSize: number; concurrency: number }; // step 3; omit to run Jev only
  onProgress?: (done: number, stage: string) => void;
};

/** Pipeline B: (1–2) Jev fan-out per sentence, flag at threshold; (3) LLM explains only the flagged sentences. */
export async function runB(sentences: Sentence[], opts: PipelineBOptions): Promise<PipelineRun> {
  // ---- steps 1–2: Jev ----
  let jevCost = 0;
  let done = 0;
  const started = performance.now();
  const results = await pool(sentences, opts.concurrency, async (s): Promise<SentenceResult> => {
    const base = { id: s.id, text: s.text, expert: s.categories };
    try {
      const r = await jevClassify(s.text);
      jevCost += r.cost;
      return { ...base, probs: r.probs, predicted: flagged(r.probs, opts.threshold) };
    } catch (err) {
      return { ...base, predicted: [], failed: true, error: String(err) };
    } finally {
      opts.onProgress?.(++done, "jev");
    }
  });
  const jevMs = performance.now() - started;
  const stages: Stage[] = [
    { name: "jev", cost: jevCost, wallMs: jevMs, calls: sentences.length, items: sentences.length, failures: results.filter((r) => r.failed).length },
  ];

  // ---- step 3: LLM explanations for flagged sentences only (document order kept) ----
  if (opts.explain) {
    const toExplain = results.filter((r) => !r.failed && r.predicted.length > 0);
    const batches: SentenceResult[][] = [];
    for (let i = 0; i < toExplain.length; i += opts.explain.batchSize) batches.push(toExplain.slice(i, i + opts.explain.batchSize));
    const stage: Stage = { name: "llm-explain", cost: 0, wallMs: 0, calls: 0, items: toExplain.length, failures: 0, malformed: 0 };
    const explainStarted = performance.now();
    let explained = 0;
    await pool(batches, opts.explain.concurrency, async (batch) => {
      try {
        const out = await llmExplainBatch(batch.map((r) => ({ id: r.id, text: r.text, categories: r.predicted })));
        stage.cost += out.cost;
        stage.calls += out.attempts;
        stage.malformed! += out.malformed;
        for (const r of batch) {
          const e = out.labels.get(r.id);
          if (e) Object.assign(r, { explanation: e.explanation, llmAgrees: e.agree });
          else Object.assign(r, { explainError: out.error ?? "missing from reply" });
        }
      } catch (err) {
        stage.calls++;
        for (const r of batch) r.explainError = String(err);
      } finally {
        explained += batch.length;
        opts.onProgress?.(explained, "explain");
      }
    });
    stage.wallMs = performance.now() - explainStarted;
    stage.failures = toExplain.filter((r) => r.explainError).length;
    stages.push(stage);
  }

  return {
    pipeline: "B",
    results,
    cost: stages.reduce((sum, st) => sum + st.cost, 0),
    wallMs: performance.now() - started,
    calls: stages.reduce((sum, st) => sum + st.calls, 0),
    failures: results.filter((r) => r.failed).length,
    malformed: opts.explain ? stages[1]!.malformed : undefined,
    stages,
  };
}

export type PipelineAOptions = { batchSize: number; concurrency: number; onProgress?: (doneSentences: number) => void };

/** Pipeline A: LLM labels + explains batches of consecutive sentences (document order kept, so it sees neighbours). */
export async function runA(sentences: Sentence[], opts: PipelineAOptions): Promise<PipelineRun> {
  const batches: Sentence[][] = [];
  for (let i = 0; i < sentences.length; i += opts.batchSize) batches.push(sentences.slice(i, i + opts.batchSize));

  let cost = 0;
  let calls = 0;
  let malformed = 0;
  let done = 0;
  const started = performance.now();
  const perBatch = await pool(batches, opts.concurrency, async (batch): Promise<SentenceResult[]> => {
    try {
      const out = await llmLabelBatch(batch.map((s) => ({ id: s.id, text: s.text })));
      cost += out.cost;
      calls += out.attempts;
      malformed += out.malformed;
      return batch.map((s) => {
        const r = out.labels.get(s.id);
        const base = { id: s.id, text: s.text, expert: s.categories };
        return r
          ? { ...base, predicted: r.labels, explanation: r.explanation }
          : { ...base, predicted: [], failed: true, error: out.error ?? "missing from reply" };
      });
    } catch (err) {
      // HTTP failure after retries: the whole batch fails
      calls++;
      return batch.map((s) => ({ id: s.id, text: s.text, expert: s.categories, predicted: [], failed: true, error: String(err) }));
    } finally {
      done += batch.length;
      opts.onProgress?.(done);
    }
  });
  const results = perBatch.flat();
  return {
    pipeline: "A",
    results,
    cost,
    wallMs: performance.now() - started,
    calls,
    failures: results.filter((r) => r.failed).length,
    malformed,
  };
}
