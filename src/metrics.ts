// Shared scoring for every pipeline. Works on label sets, so pipelines A and B are scored identically.

export type Tally = { tp: number; fp: number; fn: number; tn: number };
export type Scores = { precision: number; recall: number; f1: number; f2: number; support: number } & Tally;

/** One scored sentence: expert labels vs predicted labels. failed = no usable prediction. */
export type Scored = { id: string; expert: string[]; predicted: string[]; failed?: boolean };

export function scores(t: Tally): Scores {
  const precision = t.tp + t.fp ? t.tp / (t.tp + t.fp) : 0;
  const recall = t.tp + t.fn ? t.tp / (t.tp + t.fn) : 0;
  // F-beta: beta 2 weights recall twice as much (missing an unfair clause is worse than a false alarm)
  const f = (b: number) => (precision + recall ? ((1 + b * b) * precision * recall) / (b * b * precision + recall) : 0);
  return { ...t, precision, recall, f1: f(1), f2: f(2), support: t.tp + t.fn };
}

function tally(rows: Scored[], pred: (r: Scored) => boolean, truth: (r: Scored) => boolean): Tally {
  const t: Tally = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const r of rows) {
    // A failed prediction counts as "nothing flagged": it can only hurt recall, never help.
    const p = !r.failed && pred(r);
    const e = truth(r);
    if (p && e) t.tp++;
    else if (p) t.fp++;
    else if (e) t.fn++;
    else t.tn++;
  }
  return t;
}

export function perCategory(rows: Scored[], categories: string[]): Record<string, Scores> {
  return Object.fromEntries(
    categories.map((c) => [c, scores(tally(rows, (r) => r.predicted.includes(c), (r) => r.expert.includes(c)))]),
  );
}

export function micro(perCat: Record<string, Scores>): Scores {
  const t: Tally = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const s of Object.values(perCat)) (["tp", "fp", "fn", "tn"] as const).forEach((k) => (t[k] += s[k]));
  return scores(t);
}

export function macroF1(perCat: Record<string, Scores>): number {
  const v = Object.values(perCat);
  return v.reduce((sum, s) => sum + s.f1, 0) / v.length;
}

/** Sentence level: is an unfair sentence flagged at all (any category)? This is what a user sees. */
export function sentenceLevel(rows: Scored[]): Scores {
  return scores(tally(rows, (r) => r.predicted.length > 0, (r) => r.expert.length > 0));
}

/** Exact-match: predicted label set equals expert label set. */
export function exactMatch(rows: Scored[]): number {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  return rows.filter((r) => !r.failed && same(r.expert, r.predicted)).length / rows.length;
}
