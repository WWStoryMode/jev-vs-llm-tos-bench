// Shapes of the files written by scripts/build-replay.ts (ui/public/replay/*.json).

export type Measured = {
  jevCostPerSentence: number;
  llmOnly: LlmOnlyBaseline[]; // one per recorded LLM-only run (e.g. Sonnet 5.5, Haiku 5.5)
  explain: ExplainBaseline[]; // one per model with saved "Why?" explanations; the first is the default
  jevMsPerCall: number;
  jevConcurrency: number;
};

/** A recorded LLM-only run used as a cost baseline. */
export type LlmOnlyBaseline = { model: string; costPerSentence: number; costPerChar: number };

/** A model that explained the recorded flags, with its measured cost per flag. */
export type ExplainBaseline = { model: string; costPerFlag: number };

/** One saved explanation of a flag. */
export type SavedExplanation = { explanation: string; llmAgrees?: boolean };

export type Meta = {
  jevModel: string;
  llmOnlyModel: string;
  rubricVersion: string;
  threshold: number; // the threshold B's explanations were recorded at
};

export type ReplaySentence = {
  id: string;
  text: string; // original, tokenised + lowercased
  displayText: string;
  expert: string[]; // expert categories; [] = fair
  jev: { probs: Record<string, number>; explanations?: Record<string, SavedExplanation> }; // keyed by model
  llmOnly: { labels: string[]; explanation?: string };
  error?: string; // Live mode: this sentence's Jev call failed (shown as "error, retry", never as fair)
};

export type ReplayDoc = { slug: string; name: string; measured: Measured; meta: Meta; sentences: ReplaySentence[] };

export type ReplayIndex = {
  defaultSlug: string;
  measured: Measured;
  meta: Meta;
  documents: { slug: string; name: string; sentences: number; unfair: number; flagged: number; expertCategories: string[] }[];
};
