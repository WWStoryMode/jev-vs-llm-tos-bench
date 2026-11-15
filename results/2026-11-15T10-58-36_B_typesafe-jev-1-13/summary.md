# Pipeline B — data/val_sample_530.jsonl

| | |
|---|---|
| Date | 2026-11-15T10:58:36.797Z |
| Model | typesafe/jev-1.13 |
| Rubric | v1 |
| Sentences | 530 (230 unfair) |
| Threshold | 0.5 |
| Wall-clock | 17.3 s (concurrency 8) → **3.3 s per 100 sentences** |
| Cost | $0.025069 → **$0.00473 per 100**, $0.0473 per 1k, $4.73 per 100k |
| Reliability | 0 failed of 530 calls (0.00%), 0 retries |

## Accuracy @ 0.5

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 67 | 64 | 26 | 3 | 0.71 | 0.96 | 0.82 | 0.89 |
| unilateral_termination | 59 | 56 | 17 | 3 | 0.77 | 0.95 | 0.85 | 0.91 |
| unilateral_change | 28 | 23 | 21 | 5 | 0.52 | 0.82 | 0.64 | 0.74 |
| content_removal | 32 | 28 | 20 | 4 | 0.58 | 0.88 | 0.70 | 0.80 |
| contract_by_using | 18 | 18 | 8 | 0 | 0.69 | 1.00 | 0.82 | 0.92 |
| choice_of_law | 18 | 16 | 0 | 2 | 1.00 | 0.89 | 0.94 | 0.91 |
| jurisdiction | 18 | 17 | 2 | 1 | 0.89 | 0.94 | 0.92 | 0.93 |
| arbitration | 9 | 9 | 4 | 0 | 0.69 | 1.00 | 0.82 | 0.92 |
| **micro** | 249 | 231 | 98 | 18 | 0.70 | 0.93 | **0.80** | 0.87 |
| **sentence (any category)** | 230 | 222 | 53 | 8 | 0.81 | 0.97 | **0.88** | 0.93 |

Macro-F1: 0.81 · Exact label-set match: 80.75%

## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 |
|---|---|---|---|---|---|---|---|
| 0.3 | 0.60 | 0.96 | 0.74 | 0.75 | 0.98 | 0.85 | 0.92 |
| 0.4 | 0.65 | 0.94 | 0.77 | 0.79 | 0.97 | 0.87 | 0.93 |
| 0.5 | 0.70 | 0.93 | 0.80 | 0.81 | 0.97 | 0.88 | 0.93 |
| 0.6 | 0.76 | 0.92 | 0.83 | 0.85 | 0.96 | 0.90 | 0.94 |
| 0.7 | 0.82 | 0.91 | 0.86 | 0.88 | 0.94 | 0.91 | 0.93 |
| 0.8 | 0.86 | 0.86 | 0.86 | 0.90 | 0.91 | 0.91 | 0.91 |
| 0.9 | 0.91 | 0.78 | 0.84 | 0.93 | 0.83 | 0.88 | 0.85 |
