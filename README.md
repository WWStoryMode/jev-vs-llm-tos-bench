# jev-vs-llm-tos-bench

Does a **Jev + LLM** pipeline beat an **LLM-only** pipeline at spotting unfair clauses in Terms of Service?

The two pipelines are compared on **accuracy, speed, cost and consistency**, scored against the expert-labelled [UNFAIR-ToS](https://huggingface.co/datasets/coastalcph/lex_glue) dataset.

This is a practice project ahead of the Founders and Coders Jev Mini Hackathon (18 Nov 2026). It's an experiment first; a demo UI comes later.

- [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md): goals, dataset, metrics
- [`PLAN.md`](PLAN.md): implementation plan and build order
- [`NOTES.md`](NOTES.md): what we learned from the Jev experiments

## Status

| Step | | |
|---|---|---|
| 1 | Jev playground + learning notes | ✅ |
| 2 | Export UNFAIR-ToS test + validation splits, build samples | ✅ |
| 3 | Tune `rubric.json` on validation (v1: sentence-level recall 0.97) | ✅ |
| 4 | Pipeline B (Jev) on the held-out test sample | ⏳ next |
| 5–7 | Pipeline A (LLM), explanations, comparison | — |

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
| `npm run typecheck` | Run the TypeScript type check |

Playground and rubric-eval runs save raw output to `results/`, which is gitignored. Tune the rubric on `data/val_sample_530.jsonl` (validation). Keep `data/sample_400.jsonl` (test) for the final comparison.

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
| `limitation_of_liability` | Does it exclude or limit the provider's liability for damages, losses or harm? |
| `unilateral_termination` | Can the provider suspend, terminate or revoke the account, access, licence or service, including for breach, or does a violation end the user's rights automatically? |
| `unilateral_change` | Can the provider alter the terms, prices, fees, features, data or usage limits by its own decision, even with notice? |
| `content_removal` | Can the provider remove, delete, block or take away the user's content or account items (usernames, data, virtual or purchased items), or does the user lose them? |
| `contract_by_using` | Is the user bound simply by using or accessing the service? |
| `choice_of_law` | Does it state which country's or state's law governs the agreement? |
| `jurisdiction` | Does it state which courts or which place disputes must be brought in? |
| `arbitration` | Does it require or allow disputes to be resolved by arbitration instead of in court? |

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

- **`noul` is the probability of yes.** The pipeline turns it into a label with a threshold (default 0.5) and keeps the raw probabilities so the threshold can be changed later without new calls. A value of 0.5 means equal odds, not "half true".
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

## Caveats

- **Class imbalance:** most sentences are fair, so we report precision and recall per category, not just accuracy.
- **Contamination:** UNFAIR-ToS is public (2019), so LLMs may have seen it during training. We plan to add 1–2 recent T&Cs labelled by the group as a check.
- **Legal scope:** the labels reflect EU consumer law. Nothing here is legal advice.
