// Phase 0 of docs/UI_BRIEF.md: turn saved benchmark results into per-document JSON for the UI's Replay mode.
// No API calls. Imports only the rubric (not config.ts), so it runs without a .env.
//
//   npm run build-replay                         # uses the default A/B runs below
//   npm run build-replay -- --a <A run dir> --b <B run dir>
//
// If data/test_docs.json is missing, it prints proposed document boundaries and exits (check them, then save the file).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadSentences, type Sentence } from "../src/data.js";
import { CATEGORIES, RUBRIC_VERSION } from "../src/rubric.js";

const { values: args } = parseArgs({
  options: {
    a: { type: "string", default: "results/2026-11-15T13-19-46_A_anthropic-claude-sonnet-5-5" },
    b: { type: "string", default: "results/2026-11-15T13-18-37_B_typesafe-jev-1-13" },
    data: { type: "string", default: "data/unfair_tos_test.jsonl" },
    docs: { type: "string", default: "data/test_docs.json" },
    out: { type: "string", default: "ui/public/replay" },
    threshold: { type: "string", default: "0.6" }, // the threshold B's explanations were recorded at
  },
});
const THRESHOLD = Number(args.threshold);

// ---------- load and join ----------

type BRow = { id: string; probs: Record<string, number>; predicted: string[]; explanation?: string; llmAgrees?: boolean };
type ARow = { id: string; predicted: string[]; explanation: string };

function readJsonl<T>(file: string): T[] {
  return readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as T);
}

const sentences = loadSentences(args.data);
const bById = new Map(readJsonl<BRow>(join(args.b, "raw.jsonl")).map((r) => [r.id, r]));
const aById = new Map(readJsonl<ARow>(join(args.a, "raw.jsonl")).map((r) => [r.id, r]));
for (const s of sentences) {
  if (!bById.has(s.id)) throw new Error(`B run has no row for ${s.id}`);
  if (!aById.has(s.id)) throw new Error(`A run has no row for ${s.id}`);
}
if (bById.size !== sentences.length || aById.size !== sentences.length) {
  throw new Error(`row counts differ: data ${sentences.length}, B ${bById.size}, A ${aById.size}`);
}

// ---------- document boundaries ----------

type Doc = { slug: string; name: string; startIdx: number; endIdx: number };

if (!existsSync(args.docs)) {
  proposeBoundaries(sentences);
  console.log(`\n${args.docs} not found. Check the boundaries above, save them there as [{ slug, name, startIdx, endIdx }], then rerun.`);
  process.exit(0);
}
const docs = JSON.parse(readFileSync(args.docs, "utf8")) as Doc[];
checkDocsCover(docs, sentences.length);

// ---------- measured cost and latency (read from the run summaries, never hard-coded) ----------

function must(m: RegExpMatchArray | null, what: string, file: string): RegExpMatchArray {
  if (!m) throw new Error(`could not find ${what} in ${file}`);
  return m;
}
/** A row of the "Stages" table: | stage | items | calls | failures | $cost | N s | */
function stageRow(md: string, stage: string, file: string) {
  const m = must(md.match(new RegExp(`\\|\\s*${stage}\\s*\\|\\s*(\\d+)\\s*\\|\\s*(\\d+)\\s*\\|\\s*\\d+\\s*\\|\\s*\\$([\\d.]+)\\s*\\|\\s*([\\d.]+) s`)), `stage "${stage}"`, file);
  return { items: Number(m[1]), calls: Number(m[2]), cost: Number(m[3]), seconds: Number(m[4]) };
}

const bFile = join(args.b, "summary.md");
const aFile = join(args.a, "summary.md");
const bMd = readFileSync(bFile, "utf8");
const aMd = readFileSync(aFile, "utf8");

const jevStage = stageRow(bMd, "jev", bFile);
const explainStage = stageRow(bMd, "llm-explain", bFile);
const concurrency = Number(must(bMd.match(/\(concurrency (\d+)/), "concurrency", bFile)[1]);
const aCost = Number(must(aMd.match(/\|\s*Cost\s*\|\s*\$([\d.]+)/), "total cost", aFile)[1]);
const aSentences = Number(must(aMd.match(/\|\s*Sentences\s*\|\s*(\d+)/), "sentence count", aFile)[1]);
const jevModel = must(bMd.match(/\|\s*Model\s*\|\s*(\S+)/), "model", bFile)[1]!;
const llmOnlyModel = must(aMd.match(/\|\s*Model\s*\|\s*(\S+)/), "model", aFile)[1]!;
const explainModel = bMd.match(/\+\s*(\S+)\s*\(explanations\)/)?.[1] ?? "";

const measured = {
  jevCostPerSentence: jevStage.cost / jevStage.items,
  llmOnlyCostPerSentence: aCost / aSentences,
  explainCostPerFlag: explainStage.items ? explainStage.cost / explainStage.items : 0,
  // Wall-clock × parallel requests ÷ calls ≈ how long one Jev call took.
  jevMsPerCall: Math.round((jevStage.seconds * 1000 * concurrency) / jevStage.calls),
  jevConcurrency: concurrency,
};
const meta = {
  jevModel,
  llmOnlyModel,
  explainModel,
  rubricVersion: RUBRIC_VERSION,
  threshold: THRESHOLD,
  sources: { a: args.a, b: args.b },
};

// ---------- display text ----------

const NO_SPACE_BEFORE = /^(?:[,.;:)!?%]|'s|'re|'ve|'ll|'m|'d|n't)$/i;

/** Undo the dataset's tokenisation: `` x '' -> "x", "a , b ." -> "a, b.", "do n't" -> "don't". Lowercase stays. */
export function displayText(text: string): string {
  const tokens = text.trim().replace(/``|''/g, '"').split(/\s+/);
  let out = "";
  let quoteOpen = false;
  let noSpaceNext = true; // no space before the first token
  for (const tok of tokens) {
    let space = !noSpaceNext;
    noSpaceNext = false;
    if (tok === '"') {
      if (quoteOpen) space = false; // closing quote hugs the word before it
      else noSpaceNext = true; // opening quote hugs the word after it
      quoteOpen = !quoteOpen;
    } else if (NO_SPACE_BEFORE.test(tok)) {
      space = false;
    } else if (tok === "(") {
      noSpaceNext = true;
    }
    out += (space ? " " : "") + tok;
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// ---------- write one file per document ----------

const flaggedAt = (probs: Record<string, number>, t: number) => CATEGORIES.filter((c) => (probs[c] ?? 0) >= t);

mkdirSync(args.out, { recursive: true });
const index = [];
const totals = { sentences: 0, unfair: 0, flagged: 0, explained: 0 };
console.log(`measured: ${JSON.stringify(measured)}\n`);
console.log(["document", "sentences", "expert unfair", `jev flagged @${THRESHOLD}`, "expert categories"].join(" | "));

for (const doc of docs) {
  const rows = sentences.slice(doc.startIdx, doc.endIdx + 1).map((s) => {
    const b = bById.get(s.id)!;
    const a = aById.get(s.id)!;
    return {
      id: s.id,
      text: s.text,
      displayText: displayText(s.text),
      expert: s.categories,
      jev: {
        probs: b.probs,
        ...(b.explanation ? { explanation: b.explanation } : {}),
        ...(b.llmAgrees !== undefined ? { llmAgrees: b.llmAgrees } : {}),
      },
      llmOnly: { labels: a.predicted, ...(a.explanation ? { explanation: a.explanation } : {}) },
    };
  });

  const unfair = rows.filter((r) => r.expert.length).length;
  const flagged = rows.filter((r) => flaggedAt(r.jev.probs, THRESHOLD).length).length;
  const explained = rows.filter((r) => r.jev.explanation).length;
  const expertCategories = [...new Set(rows.flatMap((r) => r.expert))];
  // Sanity check: our threshold logic must agree with what the eval recorded.
  for (const r of rows) {
    const recorded = bById.get(r.id)!.predicted;
    if (flaggedAt(r.jev.probs, THRESHOLD).join() !== [...recorded].sort((x, y) => CATEGORIES.indexOf(x) - CATEGORIES.indexOf(y)).join()) {
      throw new Error(`${r.id}: recomputed flags differ from the recorded ones`);
    }
  }

  writeFileSync(join(args.out, `${doc.slug}.json`), JSON.stringify({ slug: doc.slug, name: doc.name, measured, meta, sentences: rows }));
  index.push({ slug: doc.slug, name: doc.name, sentences: rows.length, unfair, flagged, expertCategories });
  totals.sentences += rows.length;
  totals.unfair += unfair;
  totals.flagged += flagged;
  totals.explained += explained;
  console.log([doc.name, rows.length, unfair, flagged, expertCategories.length].join(" | "));
}

// Default document for the picker: the most distinct expert categories, ties broken by more unfair sentences.
const defaultSlug = [...index].sort((x, y) => y.expertCategories.length - x.expertCategories.length || y.unfair - x.unfair)[0]?.slug;
writeFileSync(join(args.out, "index.json"), JSON.stringify({ defaultSlug, measured, meta, documents: index }, null, 2));

console.log(`\nTOTAL | ${totals.sentences} | ${totals.unfair} | ${totals.flagged} | (${totals.explained} with saved explanation)`);
console.log(`default document: ${defaultSlug}`);
const expected = { sentences: sentences.length, unfair: sentences.filter((s) => s.categories.length).length };
if (totals.sentences !== expected.sentences || totals.unfair !== expected.unfair || totals.explained !== totals.flagged) {
  throw new Error(`totals mismatch: expected ${JSON.stringify(expected)} and every flag explained, got ${JSON.stringify(totals)}`);
}
console.log(`OK: totals match the full split (${expected.sentences} sentences, ${expected.unfair} unfair, ${totals.flagged} flagged).`);

// ---------- helpers ----------

function checkDocsCover(docs: Doc[], n: number) {
  let next = 0;
  for (const d of docs) {
    if (d.startIdx !== next) throw new Error(`${d.slug}: starts at ${d.startIdx}, expected ${next} (gap or overlap)`);
    if (d.endIdx < d.startIdx) throw new Error(`${d.slug}: endIdx before startIdx`);
    next = d.endIdx + 1;
  }
  if (next !== n) throw new Error(`documents end at ${next - 1}, but the split has ${n} sentences`);
}

/**
 * Heuristic document starts, printed for a human to check (never saved). Two signals:
 *  1. company-name change: a "brand" is a frequent word whose mentions are concentrated in one stretch of the split;
 *     a document starts at the first mention of a new brand;
 *  2. header lines ("last updated…", "effective…", "<x> terms of service") just before that start pull it earlier.
 */
function proposeBoundaries(all: Sentence[]) {
  const isHeader = (t: string) =>
    /^(last (updated|modified|revised)|effective\b|date of last revision)/.test(t) ||
    (t.split(/\s+/).length <= 10 && /(terms of (service|use)|terms and conditions|user agreement)$/.test(t));

  // 1. brands: words with >= 25 mentions whose middle 90% of mentions spans < 400 sentences
  const mentions = new Map<string, number[]>();
  for (const s of all) for (const w of new Set(s.text.match(/[a-z][a-z.]{3,}/g) ?? [])) mentions.set(w, [...(mentions.get(w) ?? []), s.idx]);
  const brands = [...mentions.entries()]
    .filter(([, ix]) => ix.length >= 25)
    .map(([w, ix]) => ({ w, n: ix.length, first: ix[0]!, p5: ix[Math.floor(ix.length * 0.05)]!, p95: ix[Math.floor(ix.length * 0.95)]! }))
    .filter((b) => b.p95 - b.p5 < 400)
    .sort((x, y) => x.p5 - y.p5);
  // words concentrated in the same stretch belong to the same document: keep the most frequent one per stretch
  const groups: (typeof brands)[] = [];
  for (const b of brands) {
    const g = groups.find((g) => g.some((o) => Math.min(o.p95, b.p95) - Math.max(o.p5, b.p5) > 0.5 * Math.min(o.p95 - o.p5, b.p95 - b.p5)));
    if (g) g.push(b);
    else groups.push([b]);
  }
  const docBrands = groups.map((g) => g.sort((x, y) => y.n - x.n)[0]!).sort((x, y) => x.p5 - y.p5);

  // 2. start = first mention of the brand (after the previous start), moved back over header lines just before it
  const starts: { idx: number; brand: string; ambiguous: boolean }[] = [];
  for (const b of docBrands) {
    const prev = starts[starts.length - 1]?.idx ?? -1;
    let idx = b.first > prev ? b.first : b.p5;
    if (starts.length === 0) idx = 0;
    let ambiguous = false;
    for (let k = idx - 1; k > prev && k >= idx - 8; k--) {
      const t = all[k]!.text.trim();
      if (isHeader(t)) idx = k;
      else if (/^\(.*\)$/.test(t) || t.split(/\s+/).length <= 6) ambiguous = true; // short line nearby: check by hand
    }
    starts.push({ idx, brand: b.w, ambiguous });
  }

  console.log(`Proposed ${starts.length} documents from brands: ${docBrands.map((b) => `${b.w}(${b.n})`).join(", ")}\n`);
  starts.forEach((st, i) => {
    const end = (starts[i + 1]?.idx ?? all.length) - 1;
    console.log(`#${i + 1} ${st.brand}  idx ${st.idx}–${end} (${end - st.idx + 1} sentences)${st.ambiguous ? "  ⚠ check the lines before the start" : ""}`);
    for (let k = Math.max(0, st.idx - 3); k < st.idx; k++) console.log(`     ${k}  ${all[k]!.text.trim().slice(0, 100)}`);
    console.log(`  ▶ ${st.idx}  ${all[st.idx]!.text.trim().slice(0, 100)}`);
    console.log(`     … last ${end}  ${all[end]!.text.trim().slice(0, 100)}`);
  });
}
