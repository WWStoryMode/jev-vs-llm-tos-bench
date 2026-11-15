// Quick look at the exported test set: class balance + example sentences.
// Run:  npm run inspect-data                       -> per-category counts (test split)
//       npm run inspect-data -- notice             -> sentences matching a word, with their expert labels
//       npm run inspect-data -- notice --split validation
import { readFileSync } from "node:fs";

export type Sentence = { id: string; idx: number; text: string; labels: number[]; categories: string[] };

const argv = process.argv.slice(2);
const splitAt = argv.indexOf("--split");
const split = splitAt >= 0 ? argv.splice(splitAt, 2)[1]! : "test";

const rows: Sentence[] = readFileSync(`data/unfair_tos_${split}.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));

const search = argv[0];

if (!search) {
  const unfair = rows.filter((r) => r.labels.length > 0);
  const multi = rows.filter((r) => r.labels.length > 1);
  console.log(`sentences: ${rows.length}   fair: ${rows.length - unfair.length}   unfair: ${unfair.length}   multi-label: ${multi.length}`);
  const counts = new Map<string, number>();
  for (const r of rows) for (const c of r.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const [c, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(24)} ${n}`);
} else {
  const re = new RegExp(search, "i");
  const hits = rows.filter((r) => re.test(r.text));
  const flagged = hits.filter((r) => r.labels.length > 0).length;
  console.log(`"${search}": ${hits.length} sentences, ${flagged} labelled unfair\n`);
  for (const r of hits) {
    console.log(`[${r.categories.join(", ") || "fair"}] ${r.id}`);
    console.log(`  ${r.text}\n`);
  }
}
