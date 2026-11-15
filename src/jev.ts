// Pipeline B, steps 1–2: one Jev call per sentence with all 8 rubric questions; flag by threshold.
import { callJev } from "./openrouter.js";
import { CATEGORIES, rubric } from "./rubric.js";

export type JevResult = {
  probs: Record<string, number>; // category -> probability of yes
  cost: number; // USD from usage.cost
  ms: number; // latency of this call
};

/** Ask all rubric questions about one sentence in a single call (fan-out). */
export async function jevClassify(text: string): Promise<JevResult> {
  const { data, ms } = await callJev({ state: { clause: text }, questions: rubric });
  const probs: Record<string, number> = {};
  for (const c of CATEGORIES) {
    const a = data.answers[c];
    if (!a || a.type !== "noul") throw new Error(`Jev returned no noul answer for "${c}": ${JSON.stringify(a)}`);
    probs[c] = a.noul;
  }
  return { probs, cost: data.usage.cost ?? 0, ms };
}

/** Categories at or above the threshold. */
export function flagged(probs: Record<string, number>, threshold: number): string[] {
  return CATEGORIES.filter((c) => (probs[c] ?? 0) >= threshold);
}
