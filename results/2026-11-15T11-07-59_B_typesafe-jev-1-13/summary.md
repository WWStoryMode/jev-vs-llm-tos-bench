# Pipeline B — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-15T11:07:59.778Z |
| Model | typesafe/jev-1.13 |
| Rubric | v1.1 |
| Sentences | 400 (172 unfair) |
| Threshold | 0.5 |
| Wall-clock | 13.3 s (concurrency 8) → **3.3 s per 100 sentences** |
| Cost | $0.020091 → **$0.00502 per 100**, $0.0502 per 1k, $5.02 per 100k |
| Reliability | 0 failed of 400 calls (0.00%), 0 retries |

## Accuracy @ 0.5

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 37 | 11 | 1 | 0.77 | 0.97 | 0.86 | 0.93 |
| unilateral_termination | 38 | 35 | 3 | 3 | 0.92 | 0.92 | 0.92 | 0.92 |
| unilateral_change | 38 | 34 | 18 | 4 | 0.65 | 0.89 | 0.76 | 0.83 |
| content_removal | 13 | 13 | 12 | 0 | 0.52 | 1.00 | 0.68 | 0.84 |
| contract_by_using | 23 | 23 | 4 | 0 | 0.85 | 1.00 | 0.92 | 0.97 |
| choice_of_law | 13 | 13 | 2 | 0 | 0.87 | 1.00 | 0.93 | 0.97 |
| jurisdiction | 16 | 15 | 0 | 1 | 1.00 | 0.94 | 0.97 | 0.95 |
| arbitration | 7 | 6 | 2 | 1 | 0.75 | 0.86 | 0.80 | 0.83 |
| **micro** | 186 | 176 | 52 | 10 | 0.77 | 0.95 | **0.85** | 0.91 |
| **sentence (any category)** | 172 | 166 | 26 | 6 | 0.86 | 0.97 | **0.91** | 0.94 |

Macro-F1: 0.85 · Exact label-set match: 84.75%

## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 |
|---|---|---|---|---|---|---|---|
| 0.3 | 0.66 | 0.97 | 0.79 | 0.80 | 0.98 | 0.88 | 0.93 |
| 0.4 | 0.71 | 0.96 | 0.81 | 0.83 | 0.97 | 0.89 | 0.94 |
| 0.5 | 0.77 | 0.95 | 0.85 | 0.86 | 0.97 | 0.91 | 0.94 |
| 0.6 | 0.81 | 0.94 | 0.87 | 0.88 | 0.95 | 0.92 | 0.94 |
| 0.7 | 0.83 | 0.91 | 0.87 | 0.90 | 0.94 | 0.92 | 0.93 |
| 0.8 | 0.89 | 0.87 | 0.88 | 0.93 | 0.91 | 0.92 | 0.91 |
| 0.9 | 0.91 | 0.73 | 0.81 | 0.94 | 0.77 | 0.85 | 0.80 |
