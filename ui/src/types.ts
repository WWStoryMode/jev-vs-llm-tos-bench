// Shapes of the files written by scripts/build-replay.ts (ui/public/replay/*.json).

export type Measured = {
  jevCostPerSentence: number;
  llmOnlyCostPerSentence: number;
  explainCostPerFlag: number;
  jevMsPerCall: number;
  jevConcurrency: number;
};

export type Meta = {
  jevModel: string;
  llmOnlyModel: string;
  explainModel: string;
  rubricVersion: string;
  threshold: number; // the threshold B's explanations were recorded at
};

export type ReplaySentence = {
  id: string;
  text: string; // original, tokenised + lowercased
  displayText: string;
  expert: string[]; // expert categories; [] = fair
  jev: { probs: Record<string, number>; explanation?: string; llmAgrees?: boolean };
  llmOnly: { labels: string[]; explanation?: string };
};

export type ReplayDoc = { slug: string; name: string; measured: Measured; meta: Meta; sentences: ReplaySentence[] };

export type ReplayIndex = {
  defaultSlug: string;
  measured: Measured;
  meta: Meta;
  documents: { slug: string; name: string; sentences: number; unfair: number; flagged: number; expertCategories: string[] }[];
};
