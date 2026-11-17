# jev-vs-llm-tos-bench

Does a **Jev + LLM** pipeline beat an **LLM-only** pipeline at spotting unfair clauses in Terms of Service?

The two pipelines are compared on **accuracy, speed, cost and consistency**, scored against the expert-labelled [UNFAIR-ToS](https://huggingface.co/datasets/coastalcph/lex_glue) dataset.

This is a practice project ahead of the Founders and Coders Jev Mini Hackathon (18 Nov 2026). It's an experiment first; a demo UI comes later.

- [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md): goals, dataset, metrics
- [`PLAN.md`](PLAN.md): implementation plan and build order
- [`NOTES.md`](NOTES.md): what we learned from the Jev experiments

## Results

Full UNFAIR-ToS test split: 1,607 sentences, 11% unfair. Rubric v1.2, pipeline B at threshold 0.6. Details and caveats are in [NOTES.md → Final summary](NOTES.md#final-summary).

| | A: LLM only (Sonnet 5.5) | A: LLM only (Haiku 5.5) | B without LLM (Jev only) | B: Jev → LLM explains flagged |
|---|---|---|---|---|
| Sentence precision / recall | 0.58 / 0.94 | 0.57 / 0.94 | 0.58 / 0.93 | 0.58 / 0.93 |
| False-alarm rate | 8.2% | 8.4% | 8.0% (adjustable with the threshold) | 8.0% (adjustable with the threshold) |
| Cost per 100 sentences | $0.051 | **$0.0038** | $0.0055 | $0.026 |
| Latency per 100 (all at 4 requests in flight) | **6.3 s** | 5.7 s (full split) | 7.0 s | 13.9 s |
| Labels changed across 3 runs | 5.0% | 5.75% | **0.75%** | **0.75%** |
| Explanations | yes, rated 3.40 | yes, not rated | none | yes, rated **5.00** (longer explanations, a confound) |

Accuracy ties because all of them use the same rubric; the LLM step in B never changes Jev's labels. Against **Sonnet 5.5**, Jev alone gives that accuracy at about a tenth of the cost. Against **Haiku 5.5** (rerun on 2026-11-17), it doesn't: Haiku alone ties on accuracy and costs about 30% less than Jev's classification step. Jev's case then rests on:
- a **probability for each flag**, so the sensitivity can be adjusted;
- **results per sentence** (the first flag in under a second), where an LLM batch returns all at once;
- **consistency:** about 7× fewer label changes than Sonnet, and about 8× fewer than Haiku.

With Sonnet writing the explanations for the flagged sentences, B costs half as much as A-Sonnet. **Haiku 5.5 explains just as usefully at 1/13 of the cost:** $0.000094 per flag instead of $0.00119, which brings Jev + explanations to about $0.007 per 100 sentences. The demo's "Why?" uses Haiku by default (`EXPLAIN_MODEL`). In a UI, Jev's flags could show straight away, with an explanation fetched only when the user opens a flag.

## Status

| Step | | |
|---|---|---|
| 1 | Jev playground + learning notes | ✅ |
| 2 | Export UNFAIR-ToS test + validation splits, build samples | ✅ |
| 3 | Tune `rubric.json` on validation (v1: sentence-level recall 0.97) | ✅ |
| 4 | Pipeline B (Jev) on the held-out test sample (rubric v1.1: sentence recall 0.97, precision 0.86) | ✅ |
| 5 | Pipeline A (LLM only) on the same sample (sentence F1 0.92 vs Jev 0.91, at ~12× the cost) | ✅ |
| 6 | Pipeline B step 3: the LLM explains only Jev-flagged sentences. On the full test split (11% unfair) B costs ~40% less than A ($0.030 vs $0.050 per 100); precision drops to ~0.5 for both | ✅ |
| 6.5 | Rubric v1.2 + default threshold 0.6, tuned for precision on the full validation split. Full test: A and B now tie (sentence F1 0.72, P 0.58, recall 0.93–0.94, false-alarm rate 8%); B costs 49% less ($0.026 vs $0.051 per 100) | ✅ |
| 7 | Consistency (labels changed across 3 runs: A 5.0%, Jev 0.75%), latency at equal concurrency, blind explanation ratings (A 3.4, B 5.0), final summary | ✅ |
| Later | Optional: contamination check on recent T&Cs, Jev 1.14 comparison, `{clause, context}` state experiment, UI (Vite + React, threshold slider + probabilities) | — |

## The two pipelines

```
A. LLM only     sentences ──batch of ~40──▶ LLM ──▶ {id, labels[], explanation} per sentence

B. Jev + LLM    sentence ──1 call, 8 questions──▶ Jev ──▶ 8 probabilities
                                                         │ any ≥ threshold?
                                          flagged only ──▶ LLM ──▶ explanation
```

Both pipelines ask the **same 8 questions**, read from [`src/rubric.json`](src/rubric.json).

## Setup

Requires Node 22+ (the repo pins 24 in `.nvmrc`) and an [OpenRouter](https://openrouter.ai) API key. One key covers both Jev and the LLM.

```bash
nvm use
npm install
cp .env.example .env     # add your OPENROUTER_API_KEY
```

| Variable | Default | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | none (required) | Never commit it. `.env` is gitignored |
| `JEV_MODEL` | `typesafe/jev-1.13` | Pinned for reproducible results; `typesafe/jev-1.14` also exists |
| `LLM_MODEL` | `anthropic/claude-sonnet-5.5` | Any model ID from [openrouter.ai/models](https://openrouter.ai/models) |

## Scripts

| Command | What it does |
|---|---|
| `npm run play -- <experiment>` | Run a Jev experiment: `hello`, `state-shape`, `fanout`, `criteria-wording`, `types`, `context-noise` |
| `npm run llm-hello` | Make one LLM call and print `usage.cost` |
| `npm run export-data [-- validation]` | Download an UNFAIR-ToS split to `data/` (default: test) |
| `npm run make-sample [-- <size> <seed> <split>]` | Build a seeded sample: all unfair sentences plus random fair ones |
| `npm run inspect-data [-- <regex>] [--split validation]` | Show class balance, or search sentences and show their expert labels |
| `npm run rubric-check -- <category> [regex] [--file …]` | Compare a question with its candidate rewordings (`src/rubric.candidates.json`) |
| `npm run rubric-eval [-- --file …]` | Run all 8 questions per sentence; report per-category and sentence-level metrics |
| `npm run eval -- --pipeline b [--file …] [--limit N] [--threshold 0.6] [--explain-batch 10] [--no-explain]` | Run pipeline B (Jev, then LLM explanations for flagged sentences) and score it. Writes `raw.jsonl`, `metrics.csv` and `summary.md` to `results/<timestamp>_<pipeline>_<model>/` |
| `npm run eval -- --pipeline a [--file …] [--limit N] [--batch 40]` | Run pipeline A (LLM only) on batches of consecutive sentences and score it the same way |
| `npm run consistency -- <dir1> <dir2> <dir3> [--out file.md]` | Compare repeated runs: share of sentences whose labels change, accuracy spread, Jev probability spread |
| `npm run explanations-sample -- <A dir> <B dir> [--n 20]` | Build a blind CSV of paired explanations for 1–5 rating (answer key in a separate file) |
| `npm run score-explanations [-- results/step7]` | Reveal which pipeline wrote each explanation and summarise the ratings |
| `npm run test-metrics` | Check the metrics code against a hand-built example |
| `npm run typecheck` | Run the TypeScript type check |

Playground and rubric-eval runs save raw output to `results/`, which is gitignored. Tune the rubric on `data/val_sample_530.jsonl` (validation). Keep `data/sample_400.jsonl` (test) for the final comparison.

## Demo UI: Small Print Radar

A one-page demo of the main finding, **Jev decides, the LLM explains**. The brief is in [`docs/UI_BRIEF.md`](docs/UI_BRIEF.md).

```bash
npm run ui:dev        # http://localhost:5173 (Replay needs nothing else: no .env, no server)
npm run server:dev    # only for Live mode: http://127.0.0.1:8787, proxied as /api by Vite
```

The page has one text box with two ways to analyse it:

- **Replay:** load one of the 10 recorded test documents into the box. Analyse replays the saved benchmark run: the flags arrive at the measured Jev pace (8 calls in flight), and no API calls are made.
  - The threshold slider recomputes flags in the browser from the stored probabilities.
  - An expert-labels toggle shows hits, false alarms and misses.
  - "Why?" shows the saved explanation.
- **Live:** paste any T&C (at most 300 sentences), or edit a recording. The server splits the text into sentences, runs `jevClassify` 8 in flight, and streams the results as Server-Sent Events.
  - "Why?" calls the LLM for that one flag, using the benchmark's `EXPLAIN_PROMPT`. It uses `EXPLAIN_MODEL`, which defaults to Haiku 5.5 (about $0.0003 per explanation).
  - Costs are the real `usage.cost`. The LLM-only figure is an estimate: text length × the recorded LLM-only rate.
  - The server caches results by model, rubric version and sentence, so repeating a demo costs $0. It also has a per-IP rate limit, and the API key never leaves the server.

| Command | What it does |
|---|---|
| `npm run build-replay [-- --a <A run> [--a <A run>] --b <B run> --explain <dir>]` | Rebuild `ui/public/replay/*.json` from saved full-split results, with no API calls. Each `--a` becomes an LLM-only cost baseline. `--explain` takes the "Why?" texts from a re-explanation run. Document boundaries come from `data/test_docs.json`; without that file, the script prints proposed boundaries to check |
| `EXPLAIN_MODEL=<model> npm run reexplain -- <B run>` | Re-explain a B run's flagged sentences with another LLM, using the same prompt, batch size and concurrency; Jev's flags are unchanged |
| `npm run ui:build` | Production build of the UI to `ui/dist/` |

---

## Querying Jev

Jev is a classifier, not a chatbot. You send it some material and a set of questions, and it returns a typed answer with probabilities for each question. **It never returns text, so it cannot explain its answers.** In pipeline B the LLM writes the explanations.

### 1. The request

Every Jev call is one JSON body sent with `POST https://openrouter.ai/api/v1/systemone`, using your OpenRouter key as a `Bearer` token. It has three parts:

```jsonc
{
  "model": "typesafe/jev-1.13",          // the Jev version to use, pinned
  "state": { ... },                      // the material Jev judges
  "questions": { "<our-id>": { ... } }   // the judgments to make about that material
}
```

In code you don't build this by hand. `callJev()` in [`src/openrouter.ts`](src/openrouter.ts) adds the model and auth, and its TypeScript types check the request shape.

### 2. The state: one sentence

```json
"state": { "clause": "We may remove any content you post at our sole discretion." }
```

- **One sentence per call.** The expert labels are per sentence. If you send a whole passage, Jev can say it contains an unfair term but not *which* sentence.
- **Use an object, not a bare string.** That way a question can point at the field by name with backticks (`` `clause` ``). A plain string works just as well for a single field (NOTES #2), but the object leaves room for more fields later, e.g. `{clause, context}`.
- **Leave out anything Jev doesn't need.** The docs warn that irrelevant context can hurt accuracy.

### 3. The questions: our rubric

We ask 8 **noul** (yes/no) questions, one per UNFAIR-ToS category, all in **one call** per sentence. That gives the same answers as 8 separate calls at about ⅓ of the cost (NOTES #3).

| id | What `instructions` asks about `clause` |
|---|---|
| `limitation_of_liability` | Does it exclude or limit the provider's liability for damages, losses or harm, or deny refunds or compensation? (Pure warranty disclaimers and the user's own responsibility don't count.) |
| `unilateral_termination` | Can the provider suspend, terminate or revoke the account, access, licence or service, including for breach, or does a violation end the user's rights automatically? |
| `unilateral_change` | Can the provider alter the terms, prices, fees, features, data or usage limits by its own decision, even with notice? |
| `content_removal` | Can the provider remove, delete, block or take away the user's content or account items (usernames, data, virtual or purchased items), or does the user lose them? |
| `contract_by_using` | Does using or accessing the service by itself mean accepting *these terms*? (Agreeing to something narrower, like a privacy policy, doesn't count.) |
| `choice_of_law` | Does it state which country's or state's law governs the agreement? |
| `jurisdiction` | Does it state which courts or which place disputes must be brought in? |
| `arbitration` | Does the clause *itself* require disputes to be resolved by arbitration instead of in court? (Procedural details of an arbitration don't count.) |

The full wording, including the `true` and `false` criteria, is in [`src/rubric.json`](src/rubric.json). That file is the single source of truth: pipeline A builds its LLM prompt from the same text, so both pipelines are judged against identical definitions.

The rubric's ids are our own names. The dataset stores categories as numbers (label indices). Step 2 will read the index-to-name order from the dataset's metadata rather than hard-coding it.

### 4. How Jev knows the criteria

Jev hasn't been trained on our categories, and it doesn't know about UNFAIR-ToS or EU consumer law. **Everything it knows about a category is the text in that question**:

```json
"arbitration": {
  "type": "noul",
  "instructions": "Does `clause` require or allow disputes to be resolved by arbitration instead of in court?",
  "criteria": {
    "true":  "The clause mandates arbitration or lets the provider force arbitration.",
    "false": "The clause allows court proceedings, or is about something else."
  }
}
```

- **`instructions`** is the question itself. It refers to the state by field name.
- **`criteria.true`** and **`criteria.false`** describe what each answer means. Jev compares the clause against both descriptions and returns the **probability of `true`**.
- **The id (`"arbitration"`) is not used as meaning.** It's only a label for our code, so the full question must be in `instructions`.

Jev answers quickly and literally, without reasoning about what you meant. In practice that means:

| Rule | Why (from our experiments) |
|---|---|
| **Write a specific test, not a topic.** | On a courts-only clause, "Is this about how disputes are resolved?" scored 0.90 for arbitration. The precise rubric question scored 0.02 (NOTES #5). |
| **End every `false` with "…or is about something else".** | Without this, a clause that only sounds legal can match the wrong category. |
| **Expect Jev to apply your wording exactly.** | "Changes require the user's **consent**": Jev rated a notice-plus-right-to-leave clause 0.92, because notice isn't consent (NOTES #6). If an answer looks wrong, check the wording first. |
| **Use one noul per category, not one `choice`.** | `choice` puts all its probability on one option. On a clause with both termination and liability terms, it gave termination 1.0 and liability 0 (NOTES #7). |
| **Do counting, dates and arithmetic in code.** | Jev is weak at these. |
| **List concrete forms, not abstract definitions.** | Termination worded as "suspend, terminate, close, revoke… for breach, violation, fraud, or inactivity" reached F1 0.85. The same idea in general terms stayed at 0.71 (NOTES, step 3). |
| **Check the criteria for wrong assumptions first.** | v0 said termination "for a justified reason" was fair, which isn't the experts' rule. Jev followed the wording and missed 20 of 59 terminations (NOTES, step 3). |

### 5. The response

```json
{
  "answers": {
    "limitation_of_liability": { "type": "noul", "noul": 0.02 },
    "choice_of_law":           { "type": "noul", "noul": 0.99 },
    "jurisdiction":            { "type": "noul", "noul": 0.99 }
    // ... one entry per question id
  },
  "usage": { "input_tokens": 367, "output_tokens": 44, "cost": 0.000015 }
}
```

- **`noul` is the probability of yes.** The pipeline turns it into a label with a threshold (default 0.6, chosen on validation as the highest that keeps sentence recall ≥ 0.95) and keeps the raw probabilities so the threshold can be changed later without new calls. A value of 0.5 means equal odds, not "half true".
- **`usage.cost`** is added by OpenRouter, in USD. Output tokens are free, so the cost covers input only. All 8 questions on one sentence cost about **$0.00004**, roughly $0.04 per 1,000 sentences.

### Other question types (not used in the rubric)

| Type | Answer | Good for |
|---|---|---|
| `choice` | One option from up to 255, with probabilities | Exclusive decisions ("which party does this favour?") |
| `score` | Probability-weighted level from 2–10 described levels | Ranking, or thresholds such as the stretch-goal "clarity" score. 3.86 is an expected value, not a precise measurement (NOTES #7). |

See `npm run play -- types` for all three on one clause.

### Calling via OpenRouter vs TypeSafe directly

The request body and answers are the same either way. Through OpenRouter:
- the endpoint is `openrouter.ai/api/v1/systemone`
- the model IDs have a `typesafe/` prefix
- you use your OpenRouter key
- responses include `usage.cost`
- errors use OpenRouter's `{error:{code,message}}` format

References: [Jev on OpenRouter](https://openrouter.ai/docs/guides/community/jev) · [TypeSafe API](https://docs.typesafe.ai/api) · [Primitives](https://docs.typesafe.ai/primitives) · [State](https://docs.typesafe.ai/concepts/state)

---

## Jev prompt vs LLM prompt

Both pipelines build their prompts from **`src/rubric.json`**, so each category has the same definition in both. Only the wrapper differs:

- **Jev:** `src/jev.ts` → `jevClassify()` sends the rubric questions as they are.
- **LLM:** `src/llm.ts` → `rubricText()` and `SYSTEM_PROMPT` turn the same questions into prose. `` `clause` `` becomes "the sentence", `true` becomes "Yes when" and `false` becomes "No when".

Here's what each one gets for one category (arbitration).

**Jev**: one sentence per call, sent as JSON:
```json
{
  "model": "typesafe/jev-1.13",
  "state": { "clause": "<one sentence>" },
  "questions": {
    "arbitration": {
      "type": "noul",
      "instructions": "Does `clause` itself require disputes or claims to be resolved by arbitration instead of in court?",
      "criteria": { "true": "imposes arbitration: ...", "false": "only describes how an arbitration works, ..." }
    },
    "...7 more categories": {}
  }
}
```
→ returns `{"arbitration": {"type": "noul", "noul": 0.97}, ...}`

**LLM**: 40 consecutive sentences per call. The system prompt is prose:
```
You review Terms of Service sentences for potentially unfair terms under EU consumer law.
...
- arbitration
  Question: Does the sentence itself require disputes or claims to be resolved by arbitration instead of in court?
  Yes when: imposes arbitration: ...
  No when: only describes how an arbitration works, ...
...
Respond with JSON only ... {"results": [{"id", "labels", "explanation"}]}
Rules: include every id exactly once ...
```
The user message lists the sentences with their ids: `[test-0001] sentence…` / `[test-0002] sentence…` (40 lines).

**Differences that matter for the benchmark:**

| | Jev | LLM |
|---|---|---|
| Context | The sentence on its own | 40 neighbouring sentences, used only to resolve references like "those courts" |
| Output | A probability for each category; we choose the threshold | Labels only (yes or no), plus an explanation |
| Format rules | None; the API defines the structure | Spelled out in the prompt, checked with zod, retried once if malformed |
| Role framing | None ("EU consumer law" doesn't appear) | One line saying it reviews terms "under EU consumer law" |
| Calls | 1 per sentence (8 questions in each call) | 1 per 40 sentences |

The context row explains the 2 unfair sentences that only the LLM caught in step 5: test-0566 ("those courts") and test-0759. See NOTES.md, step 5.

---

## Caveats

- **Class imbalance:** most sentences are fair, so we report precision and recall per category, not just accuracy.
- **Contamination:** UNFAIR-ToS is public (2019), so LLMs may have seen it during training. We plan to add 1–2 recent T&Cs labelled by the group as a check.
- **Legal scope:** the labels reflect EU consumer law. Nothing here is legal advice.
