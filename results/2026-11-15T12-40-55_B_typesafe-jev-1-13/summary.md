# Pipeline B — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-15T12:40:55.150Z |
| Model | typesafe/jev-1.13 + anthropic/claude-sonnet-5.5 (explanations) |
| Rubric | v1.1 |
| Sentences | 400 (172 unfair) |
| Threshold | 0.5 · explanations: 10 flagged sentences per call |
| Wall-clock | 44.7 s (concurrency 8, explain 4) → **11.2 s per 100 sentences** |
| Cost | $0.249519 → **$0.06238 per 100**, $0.6238 per 1k, $62.38 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 420 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy @ 0.5

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 37 | 10 | 1 | 0.79 | 0.97 | 0.87 | 0.93 |
| unilateral_termination | 38 | 35 | 3 | 3 | 0.92 | 0.92 | 0.92 | 0.92 |
| unilateral_change | 38 | 34 | 18 | 4 | 0.65 | 0.89 | 0.76 | 0.83 |
| content_removal | 13 | 13 | 12 | 0 | 0.52 | 1.00 | 0.68 | 0.84 |
| contract_by_using | 23 | 23 | 5 | 0 | 0.82 | 1.00 | 0.90 | 0.96 |
| choice_of_law | 13 | 13 | 3 | 0 | 0.81 | 1.00 | 0.90 | 0.96 |
| jurisdiction | 16 | 15 | 0 | 1 | 1.00 | 0.94 | 0.97 | 0.95 |
| arbitration | 7 | 6 | 2 | 1 | 0.75 | 0.86 | 0.80 | 0.83 |
| **micro** | 186 | 176 | 53 | 10 | 0.77 | 0.95 | **0.85** | 0.90 |
| **sentence (any category)** | 172 | 166 | 28 | 6 | 0.86 | 0.97 | **0.91** | 0.94 |

Macro-F1: 0.85 · Exact label-set match: 84.50%

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| jev | 400 | 400 | 0 | $0.020091 | 16.6 s |
| llm-explain | 194 | 20 | 0 | $0.229428 | 28.0 s |
| **total** | | 420 | | **$0.249519** | **44.7 s** |

## Explanations (step 3)

194 of 194 flagged sentences explained.

The LLM was also asked whether it agrees a flagged category applies. Labels were **not** changed; this shows what an LLM veto would do:

| | expert: unfair | expert: fair |
|---|---|---|
| LLM agrees | 160 | 18 |
| LLM disagrees (would veto) | 6 | 10 |

Sentence level with the veto: P 0.90, R 0.93, F1 0.91, F2 0.92 (without: P 0.86, R 0.97, F1 0.91, F2 0.94).

## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 |
|---|---|---|---|---|---|---|---|
| 0.3 | 0.67 | 0.96 | 0.79 | 0.80 | 0.98 | 0.88 | 0.94 |
| 0.4 | 0.71 | 0.96 | 0.82 | 0.83 | 0.98 | 0.90 | 0.94 |
| 0.5 | 0.77 | 0.95 | 0.85 | 0.86 | 0.97 | 0.91 | 0.94 |
| 0.6 | 0.81 | 0.93 | 0.86 | 0.89 | 0.95 | 0.92 | 0.94 |
| 0.7 | 0.84 | 0.91 | 0.87 | 0.90 | 0.94 | 0.92 | 0.93 |
| 0.8 | 0.88 | 0.87 | 0.87 | 0.92 | 0.91 | 0.91 | 0.91 |
| 0.9 | 0.91 | 0.74 | 0.81 | 0.94 | 0.77 | 0.85 | 0.80 |
