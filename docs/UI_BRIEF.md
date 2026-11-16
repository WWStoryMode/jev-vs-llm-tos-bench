# UI demo brief: "Small Print Radar"

A one-page web demo of the benchmark's main finding: **Jev decides, the LLM explains.**

Put this file at `docs/UI_BRIEF.md` in `jev-vs-llm-tos-bench`. Read it together with `README.md` and `NOTES.md` → *Final summary*.

## Goal

In about 30 seconds, a viewer should see the four things Jev does better in this project:

1. **Speed:** flags appear sentence by sentence, almost immediately.
2. **Adjustable sensitivity:** a threshold slider changes the flags instantly, with no new API calls.
3. **Low cost:** a live counter shows Jev's cost next to what an LLM-only run would cost.
4. **Explain on demand:** the LLM writes an explanation only when someone clicks a flag.

Honesty is part of the demo. An "expert labels" toggle shows hits, misses and false alarms.

**Build order:** Phase 0 → 1 → 2 → 3. **Replay mode must be finished and demo-ready before starting Live mode.**

---

## Architecture

```
/ui                 Vite + React + TypeScript (new)
  /public/replay    generated JSON, one file per document (Phase 0)
/server             tiny Node server for Live mode only (Phase 2)
/scripts/build-replay.ts   (Phase 0)
```

- **Reuse what exists:** `src/rubric.json`, `src/jev.ts` (`jevClassify`), `src/llm.ts` (the explain path), `src/openrouter.ts` and `src/config.ts`. Do not fork the rubric.
- **API keys stay server-side.** The browser only ever calls `/api/*` on our own server (Vite dev proxy → `/server`). It never calls OpenRouter directly.
- Keep dependencies minimal: React, Vite, and the existing zod and dotenv. Plain CSS is fine. Ask before adding a UI library.
- Add npm scripts:
  - `ui:dev` (Vite)
  - `server:dev` (`tsx watch server/index.ts`)
  - `build-replay`

---

## Phase 0: replay data (no API calls)

Write `scripts/build-replay.ts` to generate `ui/public/replay/*.json` from data already in the repo.

### Sources

| Data | Location |
|---|---|
| Sentences and expert labels | `data/unfair_tos_test.jsonl` |
| Jev probabilities, plus explanations for sentences flagged at 0.6 | `results/2026-11-15T13-18-37_B_typesafe-jev-1-13/raw.jsonl` (all 1,607 sentences; 275 have `explanation`) |
| LLM-only labels and explanations | `results/2026-11-15T13-19-46_A_anthropic-claude-sonnet-5-5/raw.jsonl` |
| Measured costs and latency | the `summary.md` / `metrics.csv` files in those folders |

Read the cost and latency figures from these files rather than hard-coding them. If we rerun A with another model (for example Haiku), only the paths change.

### Document boundaries

UNFAIR-ToS has **no document IDs**. The test split is several ToS concatenated in order (academia.edu, Netflix, Snap, Evernote, …). Do this:

1. Detect likely document starts with a heuristic: sentences like "last updated…", "<company> terms of service", or a change of company name.
2. Print the proposed boundaries (first and last sentence of each document) for me to check.
3. Save the confirmed boundaries to `data/test_docs.json` as `[{ slug, name, startIdx, endIdx }]`.
4. Hand-correct anything wrong. **Do not guess silently.**

### Display text

The dataset text is lowercased and tokenized (`` `` academia.edu '' ``, `" , "`, `" . "`). Add a `displayText` that fixes the spacing and quote marks. Keep the original `text` for matching.

Don't attempt re-capitalisation beyond the first letter of the sentence, and say in the UI that the source is lowercased.

### Output per document

```jsonc
{
  "slug": "netflix", "name": "Netflix Terms of Use",
  "measured": {
    "jevCostPerSentence": 0.000055,
    "llmOnlyCostPerSentence": 0.00051,
    "explainCostPerFlag": 0,
    "jevMsPerCall": 270
  },
  "sentences": [
    {
      "id": "test-0407", "text": "...", "displayText": "...",
      "expert": ["unilateral_change"],
      "jev": { "probs": { "unilateral_change": 0.93 }, "explanation": "..." },
      "llmOnly": { "labels": ["unilateral_change"], "explanation": "..." }
    }
  ]
}
```

`measured` is computed from the summaries. Every value in the example above is illustrative only.

**Check:** the script prints each document's name, sentence count, expert-unfair count, and Jev-flagged count at 0.6. Across all documents these must total the full split: 1,607 sentences, 172 unfair, 275 flagged.

---

## Phase 1: Replay mode (the demo's safe core)

Layout: the document text on the left, the control panel on the right.

### Document panel

- **Document picker:** a list of the test documents. Default to one with a good mix of categories.
- **Sentences:** shown as flowing paragraphs, not a table.
  - A flagged sentence is highlighted in its top category's colour, with opacity scaled by probability.
  - Each highlight has small chips: `unilateral change · 0.93`. One chip per category at or above the threshold.
- **"Arrival" animation:** flags appear in document order at the measured Jev latency, with 8 requests in flight. Label it clearly: "Replay of a recorded run". A "Skip" button shows everything at once.

### Control panel

- **Threshold slider:** 0.3 to 0.9, step 0.05, default 0.6.
  - Recompute the flags client-side from the stored probabilities. There are no network calls.
  - Show the current false-alarm and recall figures *for this document* when the expert labels are on.
- **Category counts:** for example "4 limitation of liability · 3 termination…". Clicking a category filters to it and scrolls to the first match.
- **Cost panel:**
  - "This document with Jev: $X"
  - "With LLM only: $Y"
  - "×N cheaper"

  These are computed from `measured` × the sentence count. Add the explanation cost only for flags that have been opened.
- **Expert labels toggle:** marks each sentence as one of:
  - **hit:** flagged, and the experts agree
  - **false alarm:** flagged, but the experts said fair
  - **missed:** not flagged, but the experts said unfair

  Use outline styles for these, distinct from the category colours.
- **"Compare with LLM-only" toggle** (stretch): show A's labels next to Jev's and highlight sentences where they disagree.

### "Why?" on a flag

- Show the saved B explanation for that sentence.
- If the sentence is flagged only because the slider is below 0.6, there's no saved explanation. Show: "Not explained in this recording — available in Live mode."

### Footer

A short caveats line:
- "Expert labels: UNFAIR-ToS (EU consumer law, 2019). Not legal advice."
- "Model: typesafe/jev-1.13, rubric v1.2."

### Acceptance

- Works offline: no `.env` and no server needed.
- The slider updates flags in under 50 ms with no network requests (check the DevTools network tab).
- At 0.6, the flag counts per document match the Phase 0 printout.
- The expert-label totals match the dataset.

---

## Phase 2: Live mode (paste any T&C)

### Server (`/server/index.ts`)

**`POST /api/classify`** with `{ text }`:

- Split the text into sentences with `Intl.Segmenter('en', { granularity: 'sentence' })`.
- Drop empty sentences. Cap the input at **300 sentences** and return an error above that.
- Call `jevClassify` per sentence, 8 in flight, using the same rubric and threshold logic as the eval.
- **Stream results as Server-Sent Events**, one event per sentence as soon as it returns:

  ```json
  { "idx": 0, "text": "...", "probs": {}, "cost": 0.0000, "ms": 0 }
  ```

  End with a final summary event: `{ totalCost, totalMs }`.

**`POST /api/explain`** with `{ text, categories }`:

- Run the LLM explanation for **one** sentence, using the same `EXPLAIN_PROMPT`.
- Stream the text if practical; otherwise return JSON.
- Return `cost`.

**Guards:**
- An in-memory cache keyed by hash(model + rubric version + sentence), so repeating the demo doesn't cost money twice.
- A simple per-IP rate limit.
- Clear error messages.
- Never log the key.

### UI

- A "Paste your own" tab with a textarea and an Analyse button. It renders with the same components as Replay. The expert-labels toggle is hidden, because there's no answer key.
- The cost counter uses the real `usage.cost` totals.
- The LLM-only comparison is an **estimate**: input tokens × the measured A rate. Label it "estimated".
- A sentence whose call fails shows a small "error, retry" marker. It is never silently shown as "fair".

### Acceptance

- Pasting a ~100-sentence T&C shows its first flags within about 1 second and all flags within about 5 seconds.
- Re-pasting the same text is instant and costs $0 (served from the cache).
- "Why?" returns an explanation that names the user's consequence.
- No key appears in the browser bundle or the network tab.

---

## Phase 3: polish, only if time allows

- **Streaming "Why?"**, with a typing effect.
- **Preset buttons** for 2–3 recent, real T&Cs. Save the text locally so the demo doesn't depend on a website.
- **Keyboard:** ←/→ to change the threshold, `e` for expert labels.
- **Backup:** a 30-second screen recording of the Replay demo, in case the venue's Wi-Fi fails.

## Out of scope

- Accounts and databases.
- Deployment beyond `localhost`.
- Mobile layout.
- PDF upload.
- Any change to the benchmark code or its results.

---

## Before you build: update the numbers

Rerun pipeline A with a cheaper LLM, for example:

```
LLM_MODEL=anthropic/claude-haiku-5.5 npm run eval -- --pipeline a
```

Check the exact model ID on OpenRouter first. Then:

- Point `build-replay` at whichever A run you want to present.
- If the cost gap narrows, the demo should say so.

---

## The 2-minute story (for presenting the demo)

**0:00–0:15, the problem.**
"Nobody reads Terms & Conditions. Could software highlight the risky clauses as you read, cheaply enough to run on every sign-up page?"

**0:15–0:35, the experiment.**
"We compared two set-ups on 1,607 sentences that legal experts had already labelled. One used an LLM alone. The other used Jev to flag clauses and an LLM to explain only the flagged ones."

**0:35–1:10, the demo.**
Pick a document → the flags arrive → drag the slider → click "Why?" → turn on the expert labels.

**1:10–1:40, the findings.**
- Accuracy was a tie: about 93% of unfair clauses found by both.
- Jev was about a tenth of the cost (update this after the Haiku run) and about 7× more consistent across runs.
- **The surprise:** improving the questions mattered more than the choice of model. False alarms fell from 13% to 8%.
- Jev reads literally. A vague question scored a courts clause 0.90 for arbitration; a precise one scored it 0.02.

**1:40–2:00, the caveats and the takeaway.**
- Caveats: the data is public (the LLM may have seen it), and the expert labels are sometimes inconsistent.
- The takeaway: **Jev decides, the LLM explains.** Write questions as tests, not topics.
