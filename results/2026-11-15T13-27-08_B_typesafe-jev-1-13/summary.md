# Pipeline B — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-15T13:27:08.334Z |
| Model | typesafe/jev-1.13 |
| Rubric | v1.2 |
| Sentences | 400 (172 unfair) |
| Threshold | 0.6 · no explanations |
| Wall-clock | 27.2 s (concurrency 4) → **6.8 s per 100 sentences** |
| Cost | $0.022006 → **$0.00550 per 100**, $0.0550 per 1k, $5.50 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 400 API calls · 0 HTTP retries |

## Accuracy @ 0.6

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 10 | 2 | 0.78 | 0.95 | 0.86 | 0.91 |
| unilateral_termination | 38 | 34 | 3 | 4 | 0.92 | 0.89 | 0.91 | 0.90 |
| unilateral_change | 38 | 33 | 12 | 5 | 0.73 | 0.87 | 0.80 | 0.84 |
| content_removal | 13 | 13 | 11 | 0 | 0.54 | 1.00 | 0.70 | 0.86 |
| contract_by_using | 23 | 18 | 1 | 5 | 0.95 | 0.78 | 0.86 | 0.81 |
| choice_of_law | 13 | 13 | 1 | 0 | 0.93 | 1.00 | 0.96 | 0.98 |
| jurisdiction | 16 | 15 | 0 | 1 | 1.00 | 0.94 | 0.97 | 0.95 |
| arbitration | 7 | 6 | 2 | 1 | 0.75 | 0.86 | 0.80 | 0.83 |
| **micro** | 186 | 168 | 40 | 18 | 0.81 | 0.90 | **0.85** | 0.88 |
| **sentence (any category)** | 172 | 160 | 19 | 12 | 0.89 | 0.93 | **0.91** | 0.92 |

Macro-F1: 0.86 · Exact label-set match: 86.25%

False-alarm rate (fair sentences flagged): 19 of 228 = **8.33%**. Unlike precision, this does not depend on how many unfair sentences the sample has.

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| jev | 400 | 400 | 0 | $0.022006 | 27.2 s |
| **total** | | 400 | | **$0.022006** | **27.2 s** |


## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 | false-alarm rate |
|---|---|---|---|---|---|---|---|---|
| 0.3 | 0.68 | 0.96 | 0.80 | 0.83 | 0.97 | 0.89 | 0.94 | 15.35% |
| 0.4 | 0.73 | 0.96 | 0.83 | 0.85 | 0.97 | 0.91 | 0.94 | 13.16% |
| 0.5 | 0.78 | 0.92 | 0.85 | 0.88 | 0.94 | 0.91 | 0.93 | 10.09% |
| 0.6 | 0.81 | 0.90 | 0.85 | 0.89 | 0.93 | 0.91 | 0.92 | 8.33% |
| 0.7 | 0.83 | 0.87 | 0.85 | 0.91 | 0.91 | 0.91 | 0.91 | 6.58% |
| 0.8 | 0.87 | 0.80 | 0.83 | 0.92 | 0.84 | 0.88 | 0.86 | 5.70% |
| 0.9 | 0.91 | 0.69 | 0.79 | 0.95 | 0.73 | 0.82 | 0.76 | 3.07% |
