# Jev learning notes (step 1)

Model: `typesafe/jev-1.13` via OpenRouter, 14 Nov 2026. These are single runs on hand-picked examples. Treat them as observations, not statistics; the 200-sentence eval in step 4 is the real test.

Reproduce any of them with `npm run play -- <name>`. Raw requests and responses are saved in `results/playground/`, which is gitignored.

## Request anatomy
- **state**: the material being judged. Use an object (`{clause: "..."}`) so questions can point at a field by name (`` `clause` ``).
- **questions**: map of *our* id to a question. Only `instructions` and `criteria` are sent to the model; the id is just a label for our code, so it carries no meaning to Jev.
- **noul answer**: `{"type":"noul","noul":0.96}`, the probability of yes. Jev 1.13 returns no `confidence` field for noul. We apply the threshold in our own code.

## Findings

| # | Experiment | Result | Takeaway |
|---|---|---|---|
| 1 | `hello` | `unilateral_change` = 0.96. Cost: Jev $0.0000146 vs Sonnet $0.0027 | Jev cost ~1/190 of the Sonnet call |
| 2 | `state-shape` | object 0.99 vs string 0.98 | No practical difference on a clear clause. Keep the object for named references |
| 3 | `fanout` | 8 questions in 1 call = 8 separate calls (identical answers). $0.0000384 vs $0.000125 | Questions don't influence each other. One call with all 8 questions is about 3.3× cheaper, because the state is sent once |
| 4 | `fanout` (rubric v0) | Governing-law + courts sentence: law 0.99, jurisdiction 0.99, other 6 ≤ 0.03 | Draft rubric separates cleanly on a clear case |
| 5 | `criteria-wording` A | Santa Clara courts clause, `arbitration`: vague 0.90 → precise 0.02 | **Write questions as specific tests, not topics.** Vague questions fire when the topic is merely close |
| 6 | `criteria-wording` B | Notice + right to leave, `unilateral_change`: vague 0.99, precise 0.92 | Jev applies our criteria literally: "requires consent" ≠ "notice + exit". Whether 0.92 is *right* depends on the expert convention (see open questions) |
| 7 | `types` | noul 0.98. `choice` put 1.0 on termination and 0 on liability (the clause has both). `score` 3.86 with P(level 4) = 0.89 | `choice` picks exactly one option, so it can't express multi-label → use 8 nouls. `score` is an expected value over levels: use it for ranking, or take the most probable level, not as a precise amount |
| 8 | `context-noise` | Target alone 0.99, inside 9 unrelated sentences 0.99 (+22% tokens) | Unrelated noise didn't hurt here. But a passage can't say *which* sentence is unfair, so we keep one sentence per call |

## Cost facts
- `usage.cost` is in USD and covers input only. `output_tokens` is reported, but `upstream_inference_completions_cost` = 0.
- A noul with all 8 rubric questions on one sentence costs ≈ $0.00004 → ≈ $0.04 per 1,000 sentences.

## Design decisions for the pipelines
- State `{clause: <one sentence>}`, with all 8 rubric nouls in one call per sentence.
- Every `false` criterion ends with "…or is about something else" to stop topic-level matches.
- Keep raw probabilities so the threshold sweep can be recomputed without new calls.

## Dataset findings (step 2)
- Test split: 1,607 sentences; 172 are unfair (10.7%) and 14 of those are multi-label. Per category: change 38, termination 38, liability 38, contract-by-using 23, jurisdiction 16, content removal 13, choice of law 13, arbitration 7. Arbitration has only 7 positives, so its F1 will be noisy.
- **Notice does not make a change clause fair.** Of 26 test sentences that mention both changes and notice, the experts flag the sentence that *grants the power to change* even when notice is promised (test-0359: 30 days' notice; test-0798; test-1141: "notify and, where required, seek consent"; test-1396: 14 days in advance). Sentences that only *describe the notice procedure* are labelled fair (test-0016, 0680, 0857, 1577, 1589). So Jev's 0.92 in NOTES #6 matched the experts' convention. The `unilateral_change` criterion should still separate "grants the power" from "describes the procedure".
- **Continued use after a change** is labelled `contract_by_using`, not `unilateral_change` (test-0018, test-0682).
- **Some labels look inconsistent:** test-0653 ("we will try to notify you of material revisions") is `unilateral_change`, while the similar test-0680 is fair. "Modify ... at any time" for free trials and virtual items is labelled `unilateral_termination` (test-0056, test-0900). Expect a ceiling on achievable F1.
- **Some sentences depend on other sentences:** e.g. test-0857, "if we do this…". These are hard for any single-sentence classifier.

## Rubric tuning (step 3)

### Summary
The rubric is frozen at **v1**: 3 reworded questions and 5 left as v0 because they were already good. On the 530-sentence validation sample at threshold 0.5:

| | before (v0 rubric) | after (v1 rubric) |
|---|---|---|
| **Sentence-level recall** (unfair sentence flagged by any question) | 0.87 (30 missed) | **0.97 (8 missed)** |
| Sentence-level precision | 0.83 | 0.81 |
| Sentence-level F2 | 0.86 | **0.93** |
| Micro recall / precision / F1 (per category) | 0.82 / 0.73 / 0.77 | **0.93** / 0.70 / **0.80** |

The rewording caught 22 more unfair sentences for 12 more false alarms. All 8 questions on 530 sentences took about 19 s and cost $0.025.

### What changed

| Question | Version | Tuned on | What the rewording fixed | Recall | Precision | F1 |
|---|---|---|---|---|---|---|
| `unilateral_change` | v3 | test sample ⚠️ | Covers price, feature, data and usage-limit changes, "even with notice"; cutting off users counts as termination | 0.95 → 0.87 (test) | 0.52 → 0.65 (test) | 0.67 → 0.74 (test); **0.63 on validation** |
| `unilateral_termination` | v1 | validation | Termination *for breach, violation, fraud or inactivity* counts, and so does automatic termination | 0.66 → **0.95** | 0.76 → 0.78 | 0.71 → 0.85 |
| `content_removal` | v1 | validation | "Content" includes usernames, data, virtual and purchased items, and items lost when the account ends; removal for violations counts | 0.69 → **0.88** | 0.85 → 0.60 | 0.76 → 0.72 (F2 0.71 → 0.80) |
| 5 others | v0 | none | Already good on validation: recall 0.89–1.00, F1 0.82–0.94 | | | |

Rejected candidates are kept in `src/rubric.candidates.json`: change v1 and v2, termination v2, content removal v2.

### Lessons about writing Jev questions
1. **A wrong assumption in the criteria becomes a systematic miss.** v0 said removal or termination "for a specific, justified reason" was fair. The experts flag it anyway. Jev followed the wording faithfully and missed 20 terminations for breach, at 0.13–0.48. When recall is low, look for a mistaken rule in the criteria before blaming the model.
2. **Concrete lists beat abstract definitions.** Termination v1 listed actions and triggers ("suspend, terminate, close, revoke… for breach, violation, fraud, or inactivity; or a violation automatically ends…") and reached F1 0.85. v2 used the same idea in general terms ("for any reason including a breach") and stayed at F1 0.71. Content removal shows the same pattern.
3. **Long exclusion lists in `false` are a weak signal.** Change v2's "is about stopping, discontinuing…" didn't stop "change or discontinue any of our services" scoring 0.75. Jev judges mainly from the words in the clause and the positive description.
4. **Adding a word can pull in unexpected matches.** "Limit what the user can do" (change v2) pulled in "limit, suspend or terminate your use" enforcement clauses. "Revoke… license" (termination v1) pulled in ordinary grants of a "**revocable** license".
5. **Rewording mostly moves the probability, not the label.** Borderline sentences shifted by 0.15–0.3, so one threshold can't show the whole effect. Compare versions by recall and precision across thresholds.
6. **Questions are independent, but the categories overlap.** Most leftover per-category false alarms are unfair sentences under *another* label (termination flagged as content removal; continued use flagged as change). They don't affect what a user sees. This is why we report sentence-level metrics as well as per-category ones.

### Lessons about evaluation
- **Tune on validation, score on test.** Change v3 dropped from F1 0.74 on the test sample (where it was tuned) to 0.63 on validation, which shows overfitting directly. Termination and content removal were tuned only on validation. The test sample is now held out for the final comparison in step 4.
- **Recall is weighted above precision** (F2), because missing a harmful clause is worse than a false alarm. The future UI will show probabilities and let users set the threshold. At sentence level F2 stays at about 0.93 from threshold 0.3 (recall 0.98, precision 0.74) to 0.7 (recall 0.94, precision 0.88).
- **Noul answers have no `confidence` field.** The distance of the probability from 0.5 is the confidence signal. Most errors fall in 0.5–0.65; the confident errors are label-convention cases.

### The experts' conventions (as inferred from errors)
- **Change** = the provider changes *what the service or deal is* (terms, prices, fees, features, catalog data, usage limits), even with notice.
- **Termination** = the provider *ends, withdraws, suspends or revokes access*, including for breach or inactivity, and including "change or discontinue the service".
- **Contract by using** = continued use means acceptance, even when the sentence is about changes.
- **Content removal** = losing anything the user has in the account: posts, usernames, data, virtual and purchased items.
- **Fair:** section headings ("right to modify the service."), descriptions of the notice procedure, grants of a revocable licence.
- **Inconsistent labels** cap the achievable score, e.g. "change or discontinue" is termination only in test-0741 but change + termination in validation-1473.

### What single-sentence Jev can't see
Of the 8 sentence-level misses on validation, at least 4 need a neighbouring sentence:
- list fragments: validation-0472 "refuse to surface, delete or delay any listings…;" and 1318 "( iii ) any use of websites…"
- references back: 1365 "personal jurisdiction of **both courts**", 2254 "**therefore**, you should review…"

Separately, the Airbnb list (validation-0471–0476) is labelled as a block, so each fragment carries labels it doesn't show. This is where pipeline A, with neighbouring sentences in each batch, might do better.

### New tools
- `npm run rubric-check -- <category> [regex] [--file …]` compares the current question with the candidates in `src/rubric.candidates.json` in the same Jev call. It prints per-sentence probabilities, TP/FP/FN/TN, F1, F2 and a threshold sweep.
- `npm run rubric-eval [-- --file …]` runs all 8 questions per call, the way pipeline B will. It reports per-category, micro and sentence-level metrics, and saves the raw probabilities to `results/rubric-eval/`.
- `npm run export-data -- validation` and `npm run make-sample -- 530 42 validation` create the validation data: `data/unfair_tos_validation.jsonl` (2,275 sentences, 230 unfair) and `data/val_sample_530.jsonl` (230 unfair + 300 fair).

## Pipeline B: test results (step 4)

Pipeline B, steps 1–2 (Jev only: all 8 questions in one call per sentence, threshold 0.5), on the held-out test sample `data/sample_400.jsonl` (172 unfair + 228 fair). Model `typesafe/jev-1.13`.

### Headline

| | **v1** (clean held-out run) | **v1.1** (+ arbitration fix) | validation, v1 (for reference) |
|---|---|---|---|
| **Sentence-level recall** (unfair sentence flagged by any question) | 0.96 (7 missed) | **0.97** (6 missed) | 0.97 |
| Sentence-level precision | 0.81 (38 of 228 fair flagged) | **0.86** (26 flagged) | 0.81 |
| Sentence-level F1 / F2 | 0.88 / 0.93 | **0.91 / 0.94** | 0.88 / 0.93 |
| Micro F1 | 0.82 | **0.85** | 0.80 |
| Macro F1 | 0.80 | **0.85** | — |
| Exact label-set match | 81.5% | **84.75%** | — |
| Cost | $0.0047 per 100 sentences ($4.72 per 100k) | $0.0050 per 100 | $0.0047 per 100 |
| Latency | 3.5 s per 100 sentences (8 parallel calls) | 3.5 s per 100 | 3.3 s per 100 |
| Reliability | 0 failures, 0 retries / 400 | 0 / 400 | 0 / 530 |

Result folders:
- `results/2026-11-15T11-01-55_B_typesafe-jev-1-13/` (test, v1)
- `results/2026-11-15T11-07-59_B_typesafe-jev-1-13/` (test, v1.1)
- `results/2026-11-15T10-58-36_B_typesafe-jev-1-13/` (validation, v1)

**The rubric generalises.** v1 scored almost the same on the untouched test sample as on validation, so tuning on validation didn't overfit.

### Per category on test (v1.1)

| category | precision | recall | F1 | note |
|---|---|---|---|---|
| jurisdiction | 1.00 | 0.94 | 0.97 | |
| unilateral_termination | 0.88 | 0.92 | 0.90 | |
| contract_by_using | 0.82 | 1.00 | 0.90 | |
| choice_of_law | 0.81 | 1.00 | 0.90 | |
| limitation_of_liability | 0.79 | 0.97 | 0.87 | |
| arbitration | 0.75 | 0.86 | 0.80 | was 0.30 / 0.86 / 0.44 in v1 |
| unilateral_change | 0.65 | 0.87 | 0.74 | ⚠️ tuned on this sample; 0.63 F1 on validation |
| content_removal | 0.52 | 1.00 | 0.68 | |

### Arbitration fix (v1 → v1.1)
- **Problem:** in the v1 test run, arbitration precision was 0.30 (14 false alarms). Almost all were *procedural* sentences inside an arbitration section: who the arbitrator is, claims under $10,000, "the Federal Arbitration Act governs…". The experts flag only the sentence that *imposes* arbitration. This is the same power-vs-procedure pattern as change vs notice. The validation sample has only 9 arbitration positives, so it hadn't shown the problem.
- **Fix:** the new question asks whether the clause *itself* requires arbitration instead of court, and describes procedural details as `false`. It was tuned on `data/arb_tune.jsonl`: every sentence mentioning "arbitra" in the validation and train splits (429 sentences, 36 positives), with no test sentences.
  - Tuning set: false alarms fell from 194 to 43, recall went from 1.00 to 0.92.
  - Validation sample: F1 rose from 0.82 to 0.95, recall stayed at 9/9.
  - Test sample: false alarms fell from 14 to 2.
- **Precision ceiling:** most remaining false alarms in the tuning set are sentences that genuinely impose arbitration, or headings and "please read carefully" warnings, that the experts left unlabelled. They appear to label one main sentence per arbitration section. A model that sees one sentence at a time can't tell which one that is. For a user, these are correct warnings.
- ⚠️ **Caveat:** the arbitration wording was written *after seeing* the v1 test errors, so the v1.1 test score for arbitration is somewhat optimistic. **v1 is the clean held-out score.** Pipeline A will use the v1.1 wording, so the A-vs-B comparison stays like for like.

### Sentence-level misses on test (v1.1)
- **Need context:** test-0566 "consent to the exclusive jurisdiction of **those courts**", test-0542 "we may take **any of these actions**", test-0759 "limit how you connect" (0.41, borderline).
- **Likely label noise:** test-0653 (seen before), and test-0940 "**you** may terminate your Duolingo account", which is labelled termination although the *user* is the one terminating.
- **Genuine miss:** test-1334, a liability clause ("regardless of any statute… any claim…", 0.18).

### Engineering
- `src/` now holds the reusable pipeline code:
  - `data.ts`, `pool.ts`, `rubric.ts`: loading, the concurrency limit, the rubric and its version
  - `jev.ts`: `jevClassify`, `flagged`
  - `metrics.ts`: per-category, micro, macro, sentence-level and exact-match scores. A failed call counts as "nothing flagged".
  - `pipelines.ts`: `runB` returns a shared result format that pipeline A will reuse
  - `eval.ts`: the CLI, which writes `raw.jsonl`, `metrics.csv` and `summary.md`
- `openrouter.ts` retries 408, 429 and 5xx responses and network errors with exponential backoff and jitter, and counts retries.
- `scripts/test-metrics.ts` checks the metrics against a hand-built example with known answers.
- First sign of run-to-run variation: re-running validation moved one sentence across 0.5 (52 → 53 sentence-level false alarms).

## Pipeline A (LLM only) vs pipeline B (Jev): test results (step 5)

Pipeline A sends `anthropic/claude-sonnet-5.5` batches of 40 consecutive test sentences, with a system prompt built word for word from `rubric.json` v1.1 (`` `clause` `` becomes "the sentence"). The LLM returns `{id, labels, explanation}` per sentence, validated with zod. It may use neighbouring sentences only to resolve references. Same 400 test sentences, same scoring as pipeline B.

Result folder: `results/2026-11-15T11-21-30_A_anthropic-claude-sonnet-5-5/` (B v1.1: `results/2026-11-15T11-07-59_B_typesafe-jev-1-13/`).

### Head to head

| test, 400 sentences | **A: LLM only** | **B: Jev v1.1 @ 0.5** | B: Jev @ 0.6 |
|---|---|---|---|
| Sentence-level recall | 0.95 (8 missed) | **0.97** (6 missed) | 0.95 |
| Sentence-level precision | **0.89** (21 of 228 fair flagged) | 0.86 (26 flagged) | 0.88 |
| Sentence-level F1 / F2 | **0.92** / 0.94 | 0.91 / 0.94 | 0.92 / 0.94 |
| Micro F1 | **0.86** | 0.85 | 0.87 |
| Macro F1 | **0.87** | 0.85 | — |
| Exact label-set match | **87.0%** | 84.75% | — |
| Cost per 100 sentences | $0.059 | **$0.0050** (~12× cheaper) | |
| Cost per 100k sentences | $59.14 | **$5.02** | |
| Latency per 100 sentences | 6.2 s (10 batches, 4 parallel) | **3.5 s** (400 calls, 8 parallel) | |
| Malformed or failed | 0 malformed replies / 10 calls | 0 failures / 400 calls | |
| Explanations | yes, for every flag | no (added in step 6) | |
| Adjustable sensitivity | no: fixed labels, no probabilities | yes: probability per category | |

Per category, the LLM is stronger on jurisdiction (F1 1.00 vs 0.97), arbitration (0.86 vs 0.80) and change (0.80 vs 0.74). Jev is stronger on contract-by-using recall (1.00 vs 0.83) and termination recall (0.92 vs 0.87).

**Conclusion:** for *detecting* unfair clauses, the two are equally accurate within noise. At threshold 0.6, Jev matches the LLM at sentence level for about 1/12 of the cost, and it supports a sensitivity slider. The LLM adds explanations and a small benefit from context.

### Sentence-by-sentence overlap

| 172 unfair sentences | |
|---|---|
| caught by both | 162 |
| caught only by the LLM | 2 |
| caught only by Jev | 4 |
| missed by both | 4 |

Of the 228 fair sentences, both flagged the same 17, the LLM alone flagged 4 and Jev alone flagged 9.

- **The LLM's wins are the predicted context cases.** test-0566 "consent to the exclusive jurisdiction of **those courts**" (Jev 0.16) needs the previous sentence to know which courts. test-0759 "limit how you connect" (Jev 0.39) is the other. This supports the brief's hypothesis that the LLM does better where meaning depends on other sentences, but at 2 of 172 the effect is small.
- **Jev's wins are mostly contract-by-using phrasings** that the LLM read more strictly: "you agree to comply… when accessing or using our services" (Jev 0.92), "in exchange for being enabled to use the service, you agree…" (0.74), test-0585 (0.84). The fourth is test-1141, "if we make a significant change, we'll notify you" (0.79).
- **Both missed** test-0653 and test-0940 (likely label noise), plus test-1093 (arbitration) and test-1334 (liability).

### Caveats (they point in opposite directions)
- **Contamination favours the LLM.** UNFAIR-ToS has been public since 2019, so Sonnet may have seen these sentences in training. The planned check on recent T&Cs labelled by the group would test this.
- **Tuning on test favours Jev, partly.** The `unilateral_change` v3 and arbitration v1 wordings were influenced by test sentences. Pipeline A uses the same wording, so it shares some of that benefit.
- **Latency isn't like for like yet:** batched LLM calls (4 parallel) against single Jev calls (8 parallel). Step 7 should time both under comparable setups.
- **One run each:** step 7's three repeat runs will measure consistency.
- **Explanations:** pipeline A writes an explanation only for flagged sentences (`""` for fair ones), which keeps its output cost down.

### Engineering
- `src/llm.ts`: builds the prompt from the rubric, extracts JSON (tolerating code fences), validates with zod (labels must be one of the 8 categories; every id exactly once, in order), and retries a malformed reply once. A batch that still fails counts as failed, never as fair.
- `runA()` in `src/pipelines.ts` returns the same result format as `runB`, so both are scored by the same code.
- `eval.ts`: `--pipeline a [--batch 40] [--concurrency 4]`. The summary reports malformed replies and skips the threshold sweep, because the LLM returns no probabilities.
- `callLlm` now accepts `maxTokens`.

### Prompt comparison
Both prompts come from the same `rubric.json`. The README's "Jev prompt vs LLM prompt" section shows them side by side. The difference most relevant to the results: Jev sees one sentence on its own, while the LLM sees 40 neighbours. That accounts for both A-only catches (test-0566, test-0759). Jev also returns probabilities where the LLM returns yes or no, so only B can trade precision for recall with a threshold.

## Pipeline B with explanations, and the full test split (step 6)

Pipeline B now has its third stage. Jev labels every sentence. Then the LLM (Sonnet 5.5) gets only the sentences Jev flagged, together with Jev's categories. It writes a one-sentence explanation and says whether it agrees (`agree`). Jev's labels are never changed; `agree` is recorded for analysis only. The rubric is v1.1, the threshold 0.5, and explanations go in batches of 10 with 4 calls at a time.

Results folders:
- `2026-11-15T12-40-55_B_...`: B on the 400-sentence test sample
- `2026-11-15T12-42-59_B_...`: B on the full test split
- `2026-11-15T12-47-30_A_...`: A on the full test split

### Head to head (both pipelines produce labels and explanations)

| | A, 400 sample | B, 400 sample | A, full test (1,607) | B, full test (1,607) |
|---|---|---|---|---|
| Unfair share | 43% | 43% | 11% | 11% |
| Sentences explained by the LLM | all (in batches) | 194 | all (in batches) | 356 |
| **Cost per 100** | $0.059 | $0.062 | **$0.050** | **$0.030** |
| Time per 100 | 6.2 s | 11.2 s | 4.2 s | 7.1 s |
| Sentence P / R | 0.89 / 0.95 | 0.86 / 0.97 | **0.50 / 0.95** | **0.46 / 0.96** |
| Sentence F1 / F2 | 0.92 / 0.94 | 0.91 / 0.94 | 0.66 / 0.81 | 0.63 / 0.79 |
| Micro F1 · macro F1 | 0.86 · 0.87 | 0.85 · 0.85 | 0.63 · 0.70 | 0.60 · 0.62 |
| Failures / malformed | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

Cost breakdown for B:

| | 400 sample | full test |
|---|---|---|
| Jev stage | $0.020 | $0.080 |
| LLM explanation stage | $0.229 | $0.409 |

### What we learned
1. **Explanations, not classification, are where the money goes.** Jev's 12× cost advantage covered labelling only. Once B also explains what it flags, the explanation stage is 84–92% of B's cost.
   - On a sample that is 43% unfair, B costs about the same as A.
   - On the full test split (11% unfair), B costs **about 40% less** ($0.030 vs $0.050 per 100). Fewer sentences need explaining, while A still has to read every sentence.
   - B's saving grows as the share of unfair sentences shrinks.
2. **The 400-sample precision was mostly a result of its mix.** Both pipelines raise false alarms on about 11–13% of fair sentences. With 228 fair sentences that's a few dozen; with 1,435 fair sentences it outnumbers the real catches. Precision falls to about 0.5 for **both** pipelines, so this isn't a Jev weakness.
3. **Most false alarms are shared, and come from our rubric.** On the full split, 111 fair sentences were flagged by both pipelines, 52 by A only and 80 by B only.
   - Of the shared ones, 59 are `limitation_of_liability`, mostly warranty disclaimers ("makes no warranty regarding the quality…"). Our rubric counts these, but the UNFAIR-ToS annotators did not.
   - Others look arguably unfair but unlabelled, such as test-0187 ("you will arbitrate any dispute…").
   - **Next fix:** tighten `limitation_of_liability` on the validation split to exclude pure warranty disclaimers.
4. **Jev's threshold helps here.** On the full split, raising the threshold from 0.5 to 0.7 or 0.8 gives sentence precision of 0.57 or 0.66 with recall of 0.94 or 0.91. A has no threshold to adjust. This supports the UI plan to let users choose sensitivity.
5. **The LLM as a veto isn't worth it.**
   - Full split: the LLM disagreed with 55 false alarms and 2 real catches. Precision rose from 0.46 to 0.55 and recall fell from 0.96 to 0.95, but it still agreed with 136 false alarms.
   - 400 sample: the veto removed 6 real catches.
   - Raising Jev's threshold is cheaper and more effective.
6. **Latency:** B is slower because its two stages run one after the other: 65 s for Jev at concurrency 8, then 48 s for explanations. Explanations in batches of 10 cut that stage from 13.2 s to 5.7 s on 60 sentences, but cost 28% more because the system prompt is resent with each call. Step 7 will compare the pipelines at the same concurrency.
7. **The model's agree answer varies between runs even at temperature 0** (4 vs 6 vetoes on two identical validation runs). The step 7 consistency runs should measure this.

### Engineering
- `llm.ts`: A's labelling and B's explanation step now share one call → zod check → id check → retry routine (`callBatch`). B's step is `llmExplainBatch()`, with the prompt `EXPLAIN_PROMPT`, which is built from the same rubric.
- `runB()` records each stage separately (`stages`: jev and llm-explain). It saves `explanation`, `llmAgrees` and `explainError` per sentence. If explaining fails, Jev's labels for that sentence still count.
- `eval.ts`: explanations are on by default for B, and `--no-explain` turns them off. Flags `--explain-batch 10` and `--explain-concurrency 4`. The summary adds a stage table and the veto table.

## Remaining steps
- **Step 7:** 3 consistency runs per pipeline; latency at the same concurrency for both; manual 1–5 scores for a sample of explanations; final summary.
- **Later (optional):** contamination check on recent T&Cs, Jev 1.14, `{clause, context}` state, UI.

## Open questions → check in step 6+
- Run-to-run variation: `content_removal` gave 0.01 vs 0.02 on identical input. Probably small and harmless, but the consistency metric will show whether sentences near 0.5 flip label between runs.
- Related-but-different neighbours (e.g. a termination sentence next to a content-removal one) might confuse Jev more than unrelated ones did.
- Possible experiment: put neighbours in a separate field, `{clause, context}`, with questions about `` `clause` `` only. This could help clauses that depend on definitions elsewhere.
- Jev 1.14 exists. Rerun the eval with `JEV_MODEL=typesafe/jev-1.14` as a comparison.
