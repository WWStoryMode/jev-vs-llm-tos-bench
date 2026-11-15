// Export the UNFAIR-ToS test split from the Hugging Face datasets-server API.
// Run:  npm run export-data [-- test|validation|train]   (default: test)
//
// Writes:
//   data/label_names.json      index -> dataset name -> our rubric id (read from dataset features, never hard-coded)
//   data/unfair_tos_<split>.jsonl one sentence per line: {id, idx, text, labels: number[], categories: string[]}
import { mkdirSync, writeFileSync } from "node:fs";
import rubricFile from "../src/rubric.json" with { type: "json" };

const API = "https://datasets-server.huggingface.co";
const DATASET = "coastalcph/lex_glue";
const CONFIG = "unfair_tos";
const SPLIT = process.argv[2] ?? "test"; // npm run export-data -- validation
const PAGE = 100; // datasets-server max page size

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
    if (attempt >= 4) throw new Error(`${res.status} ${url}: ${await res.text()}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt)); // back off on 429/5xx
  }
}

// "Limitation of liability" -> "limitation_of_liability"
const toRubricId = (name: string) => name.toLowerCase().replace(/\s+/g, "_");

// 1. Label order straight from the dataset's features.
type Info = {
  dataset_info: {
    features: { labels: { feature: { names: string[] } } };
    splits: Record<string, { num_examples: number }>;
  };
};
const info = await getJson<Info>(`${API}/info?dataset=${DATASET}&config=${CONFIG}`);
const names = info.dataset_info.features.labels.feature.names;
const expected = info.dataset_info.splits[SPLIT]!.num_examples;

const rubricIds = new Set(Object.keys(rubricFile).filter((k) => !k.startsWith("_")));
const labelNames = names.map((name, index) => {
  const rubricId = toRubricId(name);
  if (!rubricIds.has(rubricId)) throw new Error(`Dataset label "${name}" has no rubric question "${rubricId}"`);
  return { index, name, rubricId };
});

mkdirSync("data", { recursive: true });
writeFileSync("data/label_names.json", JSON.stringify(labelNames, null, 2) + "\n");
console.log(`label_names.json: ${labelNames.map((l) => `${l.index}=${l.rubricId}`).join(", ")}`);

// 2. Page through the split.
type Rows = { rows: { row_idx: number; row: { text: string; labels: number[] } }[] };
const lines: string[] = [];
for (let offset = 0; offset < expected; offset += PAGE) {
  const url = `${API}/rows?dataset=${DATASET}&config=${CONFIG}&split=${SPLIT}&offset=${offset}&length=${PAGE}`;
  const { rows } = await getJson<Rows>(url);
  for (const { row_idx, row } of rows) {
    lines.push(
      JSON.stringify({
        id: `${SPLIT}-${String(row_idx).padStart(4, "0")}`,
        idx: row_idx,
        text: row.text,
        labels: row.labels,
        categories: row.labels.map((i) => labelNames[i]!.rubricId),
      }),
    );
  }
  process.stdout.write(`\rfetched ${lines.length}/${expected}`);
}
console.log();

if (lines.length !== expected) throw new Error(`Expected ${expected} rows, got ${lines.length}`);
writeFileSync(`data/unfair_tos_${SPLIT}.jsonl`, lines.join("\n") + "\n");
console.log(`unfair_tos_${SPLIT}.jsonl: ${lines.length} rows`);
