# Pipeline B — data/unfair_tos_validation.jsonl

| | |
|---|---|
| Date | 2026-11-15T13:13:09.470Z |
| Model | typesafe/jev-1.13 |
| Rubric | v1.1 |
| Sentences | 2275 (230 unfair) |
| Threshold | 0.5 · no explanations |
| Wall-clock | 133.0 s (concurrency 8) → **5.8 s per 100 sentences** |
| Cost | $0.124919 → **$0.00549 per 100**, $0.0549 per 1k, $5.49 per 100k |
| Reliability | 0 of 2275 sentences without a usable answer (0.00%) · 2275 API calls · 0 HTTP retries |

## Accuracy @ 0.5

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 67 | 65 | 123 | 2 | 0.35 | 0.97 | 0.51 | 0.71 |
| unilateral_termination | 59 | 56 | 38 | 3 | 0.60 | 0.95 | 0.73 | 0.85 |
| unilateral_change | 28 | 23 | 48 | 5 | 0.32 | 0.82 | 0.46 | 0.63 |
| content_removal | 32 | 28 | 45 | 4 | 0.38 | 0.88 | 0.53 | 0.70 |
| contract_by_using | 18 | 18 | 10 | 0 | 0.64 | 1.00 | 0.78 | 0.90 |
| choice_of_law | 18 | 16 | 1 | 2 | 0.94 | 0.89 | 0.91 | 0.90 |
| jurisdiction | 18 | 17 | 13 | 1 | 0.57 | 0.94 | 0.71 | 0.83 |
| arbitration | 9 | 9 | 13 | 0 | 0.41 | 1.00 | 0.58 | 0.78 |
| **micro** | 249 | 232 | 291 | 17 | 0.44 | 0.93 | **0.60** | 0.76 |
| **sentence (any category)** | 230 | 219 | 239 | 11 | 0.48 | 0.95 | **0.64** | 0.79 |

Macro-F1: 0.65 · Exact label-set match: 87.30%

False-alarm rate (fair sentences flagged): 239 of 2045 = **11.69%**. Unlike precision, this does not depend on how many unfair sentences the sample has.

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| jev | 2275 | 2275 | 0 | $0.124919 | 133.0 s |
| **total** | | 2275 | | **$0.124919** | **133.0 s** |


## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 | false-alarm rate |
|---|---|---|---|---|---|---|---|---|
| 0.3 | 0.33 | 0.96 | 0.49 | 0.38 | 0.97 | 0.55 | 0.74 | 17.95% |
| 0.4 | 0.39 | 0.94 | 0.55 | 0.43 | 0.96 | 0.59 | 0.77 | 14.28% |
| 0.5 | 0.44 | 0.93 | 0.60 | 0.48 | 0.95 | 0.64 | 0.79 | 11.69% |
| 0.6 | 0.51 | 0.93 | 0.66 | 0.54 | 0.95 | 0.69 | 0.83 | 9.10% |
| 0.7 | 0.58 | 0.90 | 0.70 | 0.61 | 0.94 | 0.74 | 0.85 | 6.75% |
| 0.8 | 0.67 | 0.84 | 0.74 | 0.69 | 0.88 | 0.78 | 0.84 | 4.40% |
| 0.9 | 0.78 | 0.71 | 0.74 | 0.80 | 0.75 | 0.77 | 0.76 | 2.15% |
