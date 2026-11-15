// Pipelines produce a common result shape so eval.ts can score and compare them identically.
import type { Sentence } from "./data.js";
import { flagged, jevClassify } from "./jev.js";
import { llmLabelBatch } from "./llm.js";
import { pool } from "./pool.js";

export type SentenceResult = {
  id: string;
  text: string;
  expert: string[];
  predicted: string[];
  probs?: Record<string, number>; // Jev only: raw probabilities, so thresholds can be re-scored offline
  explanation?: string; // LLM explanation (pipeline A; pipeline B adds it in step 6)
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
};

export type PipelineBOptions = { threshold: number; concurrency: number; onProgress?: (done: number) => void };

/** Pipeline B steps 1–2: Jev fan-out per sentence, flag at threshold. (Step 3, explanations, comes in step 6.) */
export async function runB(sentences: Sentence[], opts: PipelineBOptions): Promise<PipelineRun> {
  let cost = 0;
  let done = 0;
  const started = performance.now();
  const results = await pool(sentences, opts.concurrency, async (s): Promise<SentenceResult> => {
    const base = { id: s.id, text: s.text, expert: s.categories };
    try {
      const r = await jevClassify(s.text);
      cost += r.cost;
      return { ...base, probs: r.probs, predicted: flagged(r.probs, opts.threshold) };
    } catch (err) {
      return { ...base, predicted: [], failed: true, error: String(err) };
    } finally {
      opts.onProgress?.(++done);
    }
  });
  return {
    pipeline: "B",
    results,
    cost,
    wallMs: performance.now() - started,
    calls: sentences.length,
    failures: results.filter((r) => r.failed).length,
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
