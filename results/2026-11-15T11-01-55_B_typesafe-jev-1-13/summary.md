# Pipeline B — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-15T11:01:55.270Z |
| Model | typesafe/jev-1.13 |
| Rubric | v1 |
| Sentences | 400 (172 unfair) |
| Threshold | 0.5 |
| Wall-clock | 14.1 s (concurrency 8) → **3.5 s per 100 sentences** |
| Cost | $0.018898 → **$0.00472 per 100**, $0.0472 per 1k, $4.72 per 100k |
| Reliability | 0 failed of 400 calls (0.00%), 0 retries |

## Accuracy @ 0.5

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 37 | 10 | 1 | 0.79 | 0.97 | 0.87 | 0.93 |
| unilateral_termination | 38 | 35 | 5 | 3 | 0.88 | 0.92 | 0.90 | 0.91 |
| unilateral_change | 38 | 33 | 18 | 5 | 0.65 | 0.87 | 0.74 | 0.81 |
| content_removal | 13 | 13 | 12 | 0 | 0.52 | 1.00 | 0.68 | 0.84 |
| contract_by_using | 23 | 23 | 5 | 0 | 0.82 | 1.00 | 0.90 | 0.96 |
| choice_of_law | 13 | 13 | 3 | 0 | 0.81 | 1.00 | 0.90 | 0.96 |
| jurisdiction | 16 | 15 | 0 | 1 | 1.00 | 0.94 | 0.97 | 0.95 |
| arbitration | 7 | 6 | 14 | 1 | 0.30 | 0.86 | 0.44 | 0.63 |
| **micro** | 186 | 175 | 67 | 11 | 0.72 | 0.94 | **0.82** | 0.89 |
| **sentence (any category)** | 172 | 165 | 38 | 7 | 0.81 | 0.96 | **0.88** | 0.93 |

Macro-F1: 0.80 · Exact label-set match: 81.50%

## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 |
|---|---|---|---|---|---|---|---|
| 0.3 | 0.62 | 0.97 | 0.76 | 0.76 | 0.98 | 0.85 | 0.92 |
| 0.4 | 0.67 | 0.96 | 0.79 | 0.79 | 0.98 | 0.88 | 0.93 |
| 0.5 | 0.72 | 0.94 | 0.82 | 0.81 | 0.96 | 0.88 | 0.93 |
| 0.6 | 0.77 | 0.94 | 0.85 | 0.85 | 0.95 | 0.90 | 0.93 |
| 0.7 | 0.81 | 0.91 | 0.86 | 0.87 | 0.94 | 0.90 | 0.92 |
| 0.8 | 0.86 | 0.87 | 0.87 | 0.91 | 0.91 | 0.91 | 0.91 |
| 0.9 | 0.90 | 0.74 | 0.81 | 0.94 | 0.77 | 0.85 | 0.80 |
