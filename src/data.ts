import { readFileSync } from "node:fs";

/** One UNFAIR-ToS sentence as exported by scripts/export-data.ts. */
export type Sentence = {
  id: string; // e.g. "test-0042"
  idx: number; // row index in the split (document order)
  text: string;
  labels: number[]; // dataset label indices
  categories: string[]; // our rubric ids; empty = fair
};

export function loadSentences(file: string): Sentence[] {
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Sentence);
}
