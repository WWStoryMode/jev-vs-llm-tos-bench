# Pipeline B — data/unfair_tos_test.jsonl

| | |
|---|---|
| Date | 2026-11-15T12:42:59.529Z |
| Model | typesafe/jev-1.13 + anthropic/claude-sonnet-5.5 (explanations) |
| Rubric | v1.1 |
| Sentences | 1607 (172 unfair) |
| Threshold | 0.5 · explanations: 10 flagged sentences per call |
| Wall-clock | 113.4 s (concurrency 8, explain 4) → **7.1 s per 100 sentences** |
| Cost | $0.489237 → **$0.03044 per 100**, $0.3044 per 1k, $30.44 per 100k |
| Reliability | 0 of 1607 sentences without a usable answer (0.00%) · 1643 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy @ 0.5

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 37 | 79 | 1 | 0.32 | 0.97 | 0.48 | 0.69 |
| unilateral_termination | 38 | 35 | 22 | 3 | 0.61 | 0.92 | 0.74 | 0.84 |
| unilateral_change | 38 | 33 | 41 | 5 | 0.45 | 0.87 | 0.59 | 0.73 |
| content_removal | 13 | 13 | 27 | 0 | 0.33 | 1.00 | 0.49 | 0.71 |
| contract_by_using | 23 | 23 | 34 | 0 | 0.40 | 1.00 | 0.57 | 0.77 |
| choice_of_law | 13 | 13 | 6 | 0 | 0.68 | 1.00 | 0.81 | 0.92 |
| jurisdiction | 16 | 15 | 7 | 1 | 0.68 | 0.94 | 0.79 | 0.87 |
| arbitration | 7 | 6 | 11 | 1 | 0.35 | 0.86 | 0.50 | 0.67 |
| **micro** | 186 | 175 | 227 | 11 | 0.44 | 0.94 | **0.60** | 0.76 |
| **sentence (any category)** | 172 | 165 | 191 | 7 | 0.46 | 0.96 | **0.63** | 0.79 |

Macro-F1: 0.62 · Exact label-set match: 85.87%

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| jev | 1607 | 1607 | 0 | $0.080379 | 65.1 s |
| llm-explain | 356 | 36 | 0 | $0.408858 | 48.4 s |
| **total** | | 1643 | | **$0.489237** | **113.4 s** |

## Explanations (step 3)

356 of 356 flagged sentences explained.

The LLM was also asked whether it agrees a flagged category applies. Labels were **not** changed; this shows what an LLM veto would do:

| | expert: unfair | expert: fair |
|---|---|---|
| LLM agrees | 163 | 136 |
| LLM disagrees (would veto) | 2 | 55 |

Sentence level with the veto: P 0.55, R 0.95, F1 0.69, F2 0.83 (without: P 0.46, R 0.96, F1 0.63, F2 0.79).

## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 |
|---|---|---|---|---|---|---|---|
| 0.3 | 0.32 | 0.97 | 0.48 | 0.36 | 0.98 | 0.52 | 0.73 |
| 0.4 | 0.39 | 0.96 | 0.55 | 0.42 | 0.98 | 0.59 | 0.77 |
| 0.5 | 0.44 | 0.94 | 0.60 | 0.46 | 0.96 | 0.63 | 0.79 |
| 0.6 | 0.49 | 0.94 | 0.65 | 0.52 | 0.95 | 0.67 | 0.82 |
| 0.7 | 0.55 | 0.91 | 0.69 | 0.57 | 0.94 | 0.71 | 0.83 |
| 0.8 | 0.64 | 0.88 | 0.74 | 0.66 | 0.91 | 0.76 | 0.84 |
| 0.9 | 0.73 | 0.74 | 0.73 | 0.75 | 0.77 | 0.76 | 0.76 |
