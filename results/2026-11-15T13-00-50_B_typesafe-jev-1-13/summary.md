# Pipeline B — data/unfair_tos_validation.jsonl

| | |
|---|---|
| Date | 2026-11-15T13:00:50.348Z |
| Model | typesafe/jev-1.13 |
| Rubric | v1.1 |
| Sentences | 2275 (230 unfair) |
| Threshold | 0.5 · no explanations |
| Wall-clock | 85.1 s (concurrency 8) → **3.7 s per 100 sentences** |
| Cost | $0.114026 → **$0.00501 per 100**, $0.0501 per 1k, $5.01 per 100k |
| Reliability | 0 of 2275 sentences without a usable answer (0.00%) · 2275 API calls · 0 HTTP retries |

## Accuracy @ 0.5

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 67 | 64 | 139 | 3 | 0.32 | 0.96 | 0.47 | 0.68 |
| unilateral_termination | 59 | 56 | 52 | 3 | 0.52 | 0.95 | 0.67 | 0.81 |
| unilateral_change | 28 | 23 | 47 | 5 | 0.33 | 0.82 | 0.47 | 0.63 |
| content_removal | 32 | 28 | 43 | 4 | 0.39 | 0.88 | 0.54 | 0.70 |
| contract_by_using | 18 | 18 | 40 | 0 | 0.31 | 1.00 | 0.47 | 0.69 |
| choice_of_law | 18 | 16 | 0 | 2 | 1.00 | 0.89 | 0.94 | 0.91 |
| jurisdiction | 18 | 17 | 13 | 1 | 0.57 | 0.94 | 0.71 | 0.83 |
| arbitration | 9 | 9 | 13 | 0 | 0.41 | 1.00 | 0.58 | 0.78 |
| **micro** | 249 | 231 | 347 | 18 | 0.40 | 0.93 | **0.56** | 0.73 |
| **sentence (any category)** | 230 | 220 | 292 | 10 | 0.43 | 0.96 | **0.59** | 0.77 |

Macro-F1: 0.61 · Exact label-set match: 85.01%

False-alarm rate (fair sentences flagged): 292 of 2045 = **14.28%**. Unlike precision, this does not depend on how many unfair sentences the sample has.

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| jev | 2275 | 2275 | 0 | $0.114026 | 85.1 s |
| **total** | | 2275 | | **$0.114026** | **85.1 s** |


## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 | false-alarm rate |
|---|---|---|---|---|---|---|---|---|
| 0.3 | 0.30 | 0.96 | 0.45 | 0.34 | 0.98 | 0.50 | 0.71 | 21.76% |
| 0.4 | 0.34 | 0.94 | 0.50 | 0.38 | 0.97 | 0.54 | 0.74 | 17.75% |
| 0.5 | 0.40 | 0.93 | 0.56 | 0.43 | 0.96 | 0.59 | 0.77 | 14.28% |
| 0.6 | 0.46 | 0.92 | 0.62 | 0.50 | 0.95 | 0.65 | 0.80 | 10.86% |
| 0.7 | 0.52 | 0.91 | 0.66 | 0.54 | 0.94 | 0.69 | 0.82 | 9.00% |
| 0.8 | 0.59 | 0.86 | 0.70 | 0.61 | 0.91 | 0.73 | 0.83 | 6.41% |
| 0.9 | 0.70 | 0.76 | 0.73 | 0.72 | 0.81 | 0.76 | 0.79 | 3.57% |
