// Pipelines produce a common result shape so eval.ts can score and compare them identically.
import type { Sentence } from "./data.js";
import { flagged, jevClassify } from "./jev.js";
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
  failures: number;
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
