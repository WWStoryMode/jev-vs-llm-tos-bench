# T&C Review Benchmark: Jev + LLM vs LLM only

## Goal

Measure whether a **Jev + LLM** pipeline beats an **LLM-only** pipeline at reviewing Terms & Conditions, on:

- **Accuracy** against expert labels
- **Speed**
- **Cost**
- **Consistency**

This is an experiment first and a demo second. Build the evaluation script before any UI.

Context: practice project ahead of the Founders and Coders **Jev Mini Hackathon** (Wed 18 Nov 2026, 18:00–20:30).

---

## Key facts (verified 14 Nov 2026)

### Jev (TypeSafe AI)

- A "System One" decision model. It returns typed answers with probabilities, **not text**. It cannot explain its answers.
- Request = `model` + `state` (string / object / array) + `questions` (keyed by your own IDs).
- Question types:
  - `noul`: yes/no → probability 0–1. Criteria keys `"true"` / `"false"`.
  - `choice`: pick one of up to 255 options → choice, probabilities, confidence.
  - `score`: 2–10 described levels → score, probabilities, confidence. Ordinal only: use for thresholds and ranking, not precise magnitude.
- Limits:
  - About 32k tokens for state + one question.
  - Weak at arithmetic, counting and dates; do those in code.
  - Reads questions literally, so write precise criteria.
  - Irrelevant context hurts accuracy.
- Cost: $0.042 per million input tokens; output is free.

### Access via OpenRouter (no TypeSafe account needed)

- One `OPENROUTER_API_KEY` covers both Jev and the LLM.
- Jev endpoint: `POST https://openrouter.ai/api/v1/systemone`, model `typesafe/jev-1.13`. Pin this version; don't use `jev-latest`.
- Alternatively, use the TypeSafe SDK with:
  - `TYPESAFE_BASE_URL=https://openrouter.ai/api`
  - `TYPESAFE_API_KEY=<OpenRouter key>`
  - `npm install @typesafe-ai/sdk`
- Responses include `answers`, `usage`, and **`usage.cost`**. Use it for cost measurement in both pipelines.
- LLM: OpenRouter chat completions (OpenAI-compatible) with a Claude model. Check the exact model ID on openrouter.ai/models.
- Docs:
  - https://openrouter.ai/docs/guides/community/jev
  - https://openrouter.ai/docs/guides/community/typesafe-sdk

Example Jev request:

```json
{
  "model": "typesafe/jev-1.13",
  "state": { "clause": "We may change these terms at any time without notice." },
  "questions": {
    "unilateral_change": {
      "type": "noul",
      "instructions": "Does this clause let the provider change the terms or service on its own, without the user's agreement?",
      "criteria": {
        "true": "The provider can modify terms or service unilaterally.",
        "false": "Changes require notice and consent, or the clause is about something else."
      }
    }
  }
}
```

---

## Answer key: UNFAIR-ToS (expert-labelled)

- Hugging Face: `coastalcph/lex_glue`, config `unfair_tos`.
- Contents: 50 Terms of Service from online platforms (YouTube, eBay, Facebook…), labelled **sentence by sentence**.
- Fields: `text` (one sentence) and `labels` (a list; **empty = fair**). Multi-label.
- 8 unfair categories:
  - Limitation of liability
  - Unilateral termination
  - Unilateral change
  - Content removal
  - Contract by using
  - Choice of law
  - Jurisdiction
  - Arbitration

  **Read the exact index → name order from the dataset features. Don't hard-code it from memory.**
- Splits: train, validation, test. Use **test** for evaluation.
- Loading from Node: either a one-off Python export to JSONL (`datasets` library), or the Hugging Face datasets-server rows API.

### Caveats to report in the results

- **Imbalance:** most sentences are fair. Report precision/recall per category, not just accuracy.
- **Contamination:** this is a public 2019 dataset that LLMs may have seen in training, which could favour the LLM-only pipeline. Add 1–2 recent T&Cs, labelled by 2–3 people, as a check.
- **Legal scope:** the labels reflect EU consumer law, not legal advice.

---

## Shared rubric (`rubric.json`)

Both pipelines must use **identical** question wording. Store it in one file:

- 8 noul questions, one per UNFAIR-ToS category, with `true` / `false` criteria.
- Optional: a `clarity` score with 0–4 described levels (clear → slippery). There's no expert label for this; it's a stretch goal, labelled by the group.

---

## Pipelines

### A. LLM only

1. Send batches of ~30–50 consecutive sentences, each with an ID.
2. The LLM returns JSON per sentence: `{ id, labels: [...], explanation }`.
3. Validate the JSON with zod. Count malformed responses as a metric.

### B. Jev + LLM

1. Make one Jev call per sentence, asking all 8 noul questions together (fan-out). Run calls in parallel with a concurrency limit.
2. A sentence is flagged if any probability is at or above the threshold (default 0.5).
3. Send **only the flagged sentences** to the LLM for explanations.

---

## Metrics (eval script → CSV + summary)

| Metric | Detail |
|---|---|
| Accuracy | Per-category precision / recall / F1, plus micro-F1 |
| Threshold sweep | Jev only: F1 at 0.3 / 0.5 / 0.7 / 0.9. Optionally a calibration plot. |
| Latency | Wall-clock time per 100 sentences |
| Cost | Sum of `usage.cost` per 100 sentences |
| Consistency | Run 3× on the same sample; % of sentences whose labels change |
| Reliability | % of malformed / failed responses |
| Explanation quality | Manually rate a sample of flagged-clause explanations, 1–5 |

Start with a **sample of ~200 test sentences**, including all available unfair ones, to keep it cheap. Scale up once it works.

---

## Tech stack

- Node 20+ / TypeScript.
- Eval script: run with `tsx`.
- Later UI: Vite + React.
- **API keys stay server-side.** Use `.env` (add it to `.gitignore`); never put keys in browser code.

Suggested layout:

```
/data        exported dataset + sample files
/src
  rubric.json
  jev.ts         Jev client + pipeline B step 1–2
  llm.ts         LLM client (pipeline A + explanations for B)
  pipelines.ts
  metrics.ts
  eval.ts        entry: runs both, writes results/*.csv + summary
/results
/ui              (later) Vite + React viewer
```

---

## Build order (this evening)

1. **Hello world:** one Jev call and one LLM call through OpenRouter. Log `usage.cost`.
2. **Data:** export UNFAIR-ToS test to JSONL; make a 200-sentence sample.
3. **`rubric.json`:** write the 8 questions.
4. **Pipeline B (Jev):** run it on the sample; compute F1 against the labels.
5. **Pipeline A (LLM only):** same sample, same metrics.
6. **Explanations:** add the LLM explanation step to pipeline B.
7. **Comparison:** consistency runs, threshold sweep, summary table.
8. *(Later / hackathon)* **UI:** document view with A / B / expert highlights side by side and a metrics panel.

---

## Expectations (hypotheses to test, not conclusions)

- Jev + LLM should be much faster and cheaper per sentence. TypeSafe's own benchmark claims similar accuracy to a frontier LLM; this is vendor-run and unverified here.
- LLM-only may do better where meaning depends on other clauses or definitions, and it gives explanations for every sentence.
- At 200 sentences, the absolute cost difference will be small. Report cost per 1,000 or 100,000 sentences to show what happens at scale.
