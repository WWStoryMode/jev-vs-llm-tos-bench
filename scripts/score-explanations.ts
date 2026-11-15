// Unblind and summarise the manual explanation ratings. No API calls.
//
// Run:  npm run score-explanations [-- results/step7]
// Reads explanations_sample.csv (with rating_1 / rating_2 filled in, 1–5) and explanations_key.csv.
import { readFileSync } from "node:fs";

const dir = process.argv[2] ?? "results/step7";

/** Minimal CSV parser: quoted fields with "" escapes, commas and newlines inside quotes. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(field), (field = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [header, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  return body.map((r) => Object.fromEntries(header!.map((h, i) => [h, r[i] ?? ""])));
}

const sample = parseCsv(readFileSync(`${dir}/explanations_sample.csv`, "utf8"));
const key = new Map(parseCsv(readFileSync(`${dir}/explanations_key.csv`, "utf8")).map((k) => [k.id!, k]));

const scores: Record<"A" | "B", { all: number[]; unfair: number[]; fair: number[] }> = {
  A: { all: [], unfair: [], fair: [] },
  B: { all: [], unfair: [], fair: [] },
};
let missing = 0;
let aWins = 0;
let bWins = 0;
let ties = 0;
for (const row of sample) {
  const k = key.get(row.id!);
  const r1 = Number(row.rating_1);
  const r2 = Number(row.rating_2);
  if (!k || !(r1 >= 1 && r1 <= 5) || !(r2 >= 1 && r2 <= 5)) {
    missing++;
    continue;
  }
  const byPipeline = { [k.explanation_1!]: r1, [k.explanation_2!]: r2 } as Record<"A" | "B", number>;
  const group = row.expert_labels === "fair" ? "fair" : "unfair";
  for (const p of ["A", "B"] as const) {
    scores[p].all.push(byPipeline[p]);
    scores[p][group].push(byPipeline[p]);
  }
  if (byPipeline.A > byPipeline.B) aWins++;
  else if (byPipeline.B > byPipeline.A) bWins++;
  else ties++;
}

const mean = (xs: number[]) => (xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(2) : "–");
console.log(`# Explanation ratings (${sample.length - missing} rated${missing ? `, ${missing} skipped: missing or invalid rating` : ""})

| | A: LLM only | B: Jev + LLM explanations |
|---|---|---|
| Mean rating, all | ${mean(scores.A.all)} | ${mean(scores.B.all)} |
| Mean, expert-unfair sentences | ${mean(scores.A.unfair)} | ${mean(scores.B.unfair)} |
| Mean, expert-fair sentences (false alarms) | ${mean(scores.A.fair)} | ${mean(scores.B.fair)} |

Head to head per sentence: A better ${aWins} · B better ${bWins} · tie ${ties}`);
