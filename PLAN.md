# Plan: T&C review benchmark (Jev + LLM vs LLM only)

## Context
The brief (`PROJECT_BRIEF.md`) asks for an experiment that compares two pipelines for spotting unfair Terms of Service clauses. Pipeline B uses Jev to flag sentences, then the LLM explains only the flagged ones. Pipeline A uses the LLM alone. Both are scored against expert labels from the UNFAIR-ToS dataset on accuracy, speed, cost, consistency and reliability. This is practice for the Jev hackathon on 18 Nov 2026. The eval script comes first and the UI is out of scope for now. The repo currently holds only the brief.

**Environment findings:**
- The default `node` is v14.16.1, which is too old: there is no global `fetch` and `tsx` doesn't support it. nvm already has v20.20.2 and v24.13.0 installed. Pin `24` in `.nvmrc`.
- Python 3.14 is present, but the `datasets` library is not. Load the data from the Hugging Face datasets-server rows API in Node instead, so no Python dependency is needed.
- `OPENROUTER_API_KEY` is not set in the shell, so the user needs to put it in `.env`.

**Decisions:**
- Every model ID is configurable through `.env`: `JEV_MODEL=typesafe/jev-1.13` and `LLM_MODEL=` (a Claude model ID from OpenRouter). Both go through OpenRouter with one key, so switching models means changing one env var. Each results file records which models it used.
- Jev 1.14 now exists. The brief pins `typesafe/jev-1.13`, so keep that as the default for reproducibility. Rerunning with 1.14 is a single env change.
- Call Jev with raw `fetch` to `POST https://openrouter.ai/api/v1/systemone` rather than through the TypeSafe SDK. That means fewer dependencies and direct access to `usage.cost`.
- Call the LLM with raw `fetch` to `https://openrouter.ai/api/v1/chat/completions`. Request JSON output and read `usage.cost`; pass `usage: {include: true}` if the response doesn't include it by default.

## Layout
```
.nvmrc  .env.example  .gitignore  package.json  tsconfig.json
/data      unfair_tos_test.jsonl, label_names.json, sample_400.jsonl
/src
  config.ts      load .env, export JEV_MODEL / LLM_MODEL / key / concurrency / threshold
  openrouter.ts  shared fetch wrapper: auth headers, retry with backoff on 429/5xx, timing, cost extraction
  rubric.json    8 noul questions (instructions + true/false criteria), keyed by category slug
  rubric.ts      load rubric, map dataset label index → rubric key via label_names.json
  jev.ts         jevClassify(sentence) → {probs: Record<cat, number>, cost, ms}
  llm.ts         llmClassifyBatch(sentences) (pipeline A), llmExplain(flagged) (pipeline B), zod schemas
  pipelines.ts   runA(sample), runB(sample, threshold) → common Result[] shape
  metrics.ts     per-category P/R/F1, micro-F1, threshold sweep, consistency, cost/latency per 100
  eval.ts        CLI entry: --pipeline a|b|both --runs N --sample path
/scripts
  export-data.ts fetch test split + features from datasets-server → /data
  make-sample.ts deterministic (seeded) 400-sentence sample: all 172 unfair + 228 fair, kept in document order
  hello.ts       one Jev call + one LLM call, logs answers + usage.cost
/results         per-run JSONL (raw responses), metrics CSV, summary.md
```
Dependencies: `tsx`, `typescript`, `zod`, `dotenv`, `p-limit`. Nothing else.

## Steps (follows the brief's build order)
1. **Scaffold, then learn Jev hands-on.** This is a practice project, so step 1 is about learning the API, not only checking that a call works.
   - **Scaffold:** `.nvmrc` (24; the SDK needs Node 22+), `package.json` scripts, `.env.example` (`OPENROUTER_API_KEY`, `JEV_MODEL`, `LLM_MODEL`), and `src/openrouter.ts`, a thin fetch wrapper that logs the full request and response.
   - **Reading order (about 20 minutes):**
     1. docs.typesafe.ai/primitives (noul, choice and score; one snap judgment per question)
     2. docs.typesafe.ai/concepts/state (object state, referring to fields by `` `path` ``)
     3. docs.typesafe.ai/api (the raw request and response schema)
     4. openrouter.ai/docs/guides/community/jev (the OpenRouter differences)
   - **`scripts/jev-playground.ts`:** a set of small experiments the user edits and runs with `npx tsx scripts/jev-playground.ts <name>`. Each one prints `answers` and `usage` (including `usage.cost`) and saves the raw response to `results/playground/`.
     - `hello`: the brief's example request, verbatim.
     - `state-shape`: the same clause sent as a plain string and as `{clause}`, to compare the answers.
     - `fanout`: one sentence with all 8 rubric questions in a single call, compared with 8 separate calls, to see the cost and latency difference.
     - `criteria-wording`: a vague question against a precise one on a tricky clause, such as an arbitration sentence that also names a jurisdiction, to watch the probabilities move.
     - `types`: the same clause through `noul`, `choice` (over the 8 categories plus "none") and `score` (the clarity levels), to see what each answer type looks like.
     - `context-noise`: one target sentence alone, then wrapped in 10 surrounding sentences, to test the brief's claim that irrelevant context hurts.
   - **`scripts/llm-hello.ts`:** one chat completion through `LLM_MODEL` that logs `usage.cost`.
   - **Write-up:** `NOTES.md` records what each experiment showed. Those findings decide the final `rubric.json` wording and the state shape used in pipeline B.
   - **Division of work:** I scaffold the scripts with the experiments filled in. You change the questions and criteria and rerun them; I'm here to explain anything.
2. **Data.** `export-data.ts` does three things:
   - Calls `GET https://datasets-server.huggingface.co/info?dataset=coastalcph/lex_glue&config=unfair_tos` and reads the exact label order into `label_names.json`. The order is not hard-coded.
   - Pages through `/rows?...&split=test&offset=&length=100` and writes `unfair_tos_test.jsonl` as `{id, text, labels:number[]}`.

   `make-sample.ts` then builds the sample from all 172 unfair test sentences plus 228 seeded-random fair ones (400 in total), re-sorted into document order. We chose 400 over the brief's ~200 because 172 unfair + 28 fair would be 86% unfair and hide false positives. It prints the count per category.
3. **Rubric.** Write `rubric.json` with 8 noul questions, giving precise and literal criteria for each category. Use the EU-consumer-law framing of the UNFAIR-ToS guidelines. The `false` criterion should say "or the clause is about something else". Both pipelines build their prompts from this one file. `clarity` is left out for now as a stretch goal.
4. **Pipeline B, step 1–2.** Make one Jev call per sentence with all 8 questions, using `p-limit` with concurrency from config (default 8). Store the raw probabilities so the threshold sweep can be recomputed offline without new calls. A category is predicted when `prob ≥ threshold`. Log failures and keep going.
5. **Pipeline A.** Send batches of 40 consecutive sentences, each with an ID. The system prompt contains the rubric, and the LLM returns `{results:[{id, labels:[cat slugs], explanation}]}`. Validate with zod:
   - When a batch is malformed or has IDs missing, count it in reliability and retry once.
   - When it fails again, mark those sentences as failed. They count as errors, not as fair.
6. **Pipeline B, step 3.** Send only the flagged sentences, together with Jev's predicted categories, to the LLM for explanations. Use the same zod and batching path. Add this cost and time to B's totals.
7. **Metrics and eval.**
   - `metrics.ts` computes per-category P/R/F1 and micro-F1, plus a Jev threshold sweep at 0.3/0.5/0.7/0.9 from the stored probabilities.
   - It measures latency as wall-clock time per 100 sentences, and cost as the sum of `usage.cost` per 100 sentences, extrapolated to per 1k and per 100k.
   - Consistency is the % of sentences whose label set differs across `--runs 3`. Reliability is the % malformed or failed.
   - `eval.ts` writes `results/<timestamp>_<models>/metrics.csv` and `summary.md`. The summary contains the comparison table, the models used, the sample size, and the brief's caveats: class imbalance, contamination risk, EU-law scope, and that 400 sentences gives a small absolute cost.
   - It also writes `explanations_sample.csv`, with an empty `rating` column for the manual 1–5 explanation rating.

## Out of scope for this pass
- The UI (Vite + React).
- The `clarity` score.
- Hand-labelled recent T&Cs for the contamination check. The plan leaves room for them: they go in `data/custom_*.jsonl` and `--sample` accepts any file.

## Verification
- `nvm use && npm i && npx tsx scripts/hello.ts` prints a Jev answer and an LLM answer, each with a non-zero `usage.cost`.
- After `export-data`, the test row count matches the datasets-server `num_rows`, and `label_names.json` has 8 names.
- `make-sample` prints 400 sentences (172 unfair) with every category present, and rerunning it gives an identical file.
- `npx tsx src/eval.ts --pipeline b --sample data/sample_400.jsonl` first runs on a 10-sentence slice (`--limit 10`) to check plumbing and cost, then on the full sample. The F1 values in `summary.md` look plausible: non-zero, and the sweep changes P/R in the expected direction.
- Then `--pipeline a`, then `--pipeline both --runs 3`, and check that consistency and reliability are filled in.
- Unit-check `metrics.ts` with a tiny hand-built fixture where P/R/F1 are known: a quick assert script in `scripts/test-metrics.ts`.
