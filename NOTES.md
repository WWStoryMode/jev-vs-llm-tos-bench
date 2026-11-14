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

## Open questions → check in step 2/4
- Do UNFAIR-ToS experts label "change with notice + right to leave" as unilateral change? Look at test sentences containing "notify" or "notice". The answer decides the `unilateral_change` criterion.
- Run-to-run variation: `content_removal` gave 0.01 vs 0.02 on identical input. Probably small and harmless, but the consistency metric will show whether sentences near 0.5 flip label between runs.
- Related-but-different neighbours (e.g. a termination sentence next to a content-removal one) might confuse Jev more than unrelated ones did.
- Possible experiment: put neighbours in a separate field, `{clause, context}`, with questions about `` `clause` `` only. This could help clauses that depend on definitions elsewhere.
- Jev 1.14 exists. Rerun the eval with `JEV_MODEL=typesafe/jev-1.14` as a comparison.
