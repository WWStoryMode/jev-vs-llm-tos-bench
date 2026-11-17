// Pure threshold logic, recomputed in the browser from stored probabilities (no network).
// Mirrors flagged() in src/jev.ts, which we can't import here because it pulls in config.ts and the API key.
import { CATEGORY_IDS } from "./categories";

/** Categories at or above the threshold, in rubric order. */
export function flaggedAt(probs: Record<string, number>, threshold: number): string[] {
  return CATEGORY_IDS.filter((c) => (probs[c] ?? 0) >= threshold);
}

/** The flagged category with the highest probability (decides the highlight colour). */
export function topCategory(probs: Record<string, number>, flagged: string[]): string | undefined {
  return [...flagged].sort((a, b) => (probs[b] ?? 0) - (probs[a] ?? 0))[0];
}

export type Verdict = "hit" | "false_alarm" | "missed" | "fair";

/** Sentence-level comparison with the expert labels. */
export function verdict(flagged: string[], expert: string[]): Verdict {
  if (flagged.length) return expert.length ? "hit" : "false_alarm";
  return expert.length ? "missed" : "fair";
}
