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

## Open questions → check in step 4
- Final score: run the frozen v1 rubric **once** on the held-out test sample (`data/sample_400.jsonl`). Report that `unilateral_change` was tuned on it.
- Run-to-run variation: `content_removal` gave 0.01 vs 0.02 on identical input. Probably small and harmless, but the consistency metric will show whether sentences near 0.5 flip label between runs.
- Related-but-different neighbours (e.g. a termination sentence next to a content-removal one) might confuse Jev more than unrelated ones did.
- Possible experiment: put neighbours in a separate field, `{clause, context}`, with questions about `` `clause` `` only. This could help clauses that depend on definitions elsewhere.
- Jev 1.14 exists. Rerun the eval with `JEV_MODEL=typesafe/jev-1.14` as a comparison.
