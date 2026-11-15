# Pipeline B — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-15T13:30:19.904Z |
| Model | typesafe/jev-1.13 + anthropic/claude-sonnet-5.5 (explanations) |
| Rubric | v1.2 |
| Sentences | 400 (172 unfair) |
| Threshold | 0.6 · explanations: 10 flagged sentences per call |
| Wall-clock | 55.5 s (concurrency 4, explain 4) → **13.9 s per 100 sentences** |
| Cost | $0.237308 → **$0.05933 per 100**, $0.5933 per 1k, $59.33 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 418 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy @ 0.6

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 10 | 2 | 0.78 | 0.95 | 0.86 | 0.91 |
| unilateral_termination | 38 | 35 | 3 | 3 | 0.92 | 0.92 | 0.92 | 0.92 |
| unilateral_change | 38 | 33 | 12 | 5 | 0.73 | 0.87 | 0.80 | 0.84 |
| content_removal | 13 | 13 | 11 | 0 | 0.54 | 1.00 | 0.70 | 0.86 |
| contract_by_using | 23 | 18 | 1 | 5 | 0.95 | 0.78 | 0.86 | 0.81 |
| choice_of_law | 13 | 13 | 1 | 0 | 0.93 | 1.00 | 0.96 | 0.98 |
| jurisdiction | 16 | 15 | 0 | 1 | 1.00 | 0.94 | 0.97 | 0.95 |
| arbitration | 7 | 6 | 2 | 1 | 0.75 | 0.86 | 0.80 | 0.83 |
| **micro** | 186 | 169 | 40 | 17 | 0.81 | 0.91 | **0.86** | 0.89 |
| **sentence (any category)** | 172 | 160 | 19 | 12 | 0.89 | 0.93 | **0.91** | 0.92 |

Macro-F1: 0.86 · Exact label-set match: 86.25%

False-alarm rate (fair sentences flagged): 19 of 228 = **8.33%**. Unlike precision, this does not depend on how many unfair sentences the sample has.

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| jev | 400 | 400 | 0 | $0.022006 | 28.9 s |
| llm-explain | 179 | 18 | 0 | $0.215302 | 26.6 s |
| **total** | | 418 | | **$0.237308** | **55.5 s** |

## Explanations (step 3)

179 of 179 flagged sentences explained.

The LLM was also asked whether it agrees a flagged category applies. Labels were **not** changed; this shows what an LLM veto would do:

| | expert: unfair | expert: fair |
|---|---|---|
| LLM agrees | 153 | 15 |
| LLM disagrees (would veto) | 7 | 4 |

Sentence level with the veto: P 0.91, R 0.89, F1 0.90, F2 0.89 (without: P 0.89, R 0.93, F1 0.91, F2 0.92).

## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 | false-alarm rate |
|---|---|---|---|---|---|---|---|---|
| 0.3 | 0.68 | 0.96 | 0.80 | 0.83 | 0.97 | 0.89 | 0.94 | 15.35% |
| 0.4 | 0.73 | 0.95 | 0.83 | 0.85 | 0.97 | 0.90 | 0.94 | 13.16% |
| 0.5 | 0.77 | 0.92 | 0.84 | 0.87 | 0.94 | 0.91 | 0.93 | 10.53% |
| 0.6 | 0.81 | 0.91 | 0.86 | 0.89 | 0.93 | 0.91 | 0.92 | 8.33% |
| 0.7 | 0.84 | 0.87 | 0.85 | 0.91 | 0.91 | 0.91 | 0.91 | 6.58% |
| 0.8 | 0.88 | 0.81 | 0.84 | 0.92 | 0.85 | 0.89 | 0.87 | 5.26% |
| 0.9 | 0.91 | 0.69 | 0.79 | 0.95 | 0.73 | 0.83 | 0.77 | 2.63% |
