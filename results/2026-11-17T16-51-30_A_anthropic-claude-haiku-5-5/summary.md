# Pipeline A — data/unfair_tos_test.jsonl

| | |
|---|---|
| Date | 2026-11-17T16:51:30.709Z |
| Model | anthropic/claude-haiku-5.5 |
| Rubric | v1.2 |
| Sentences | 1607 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 91.7 s (concurrency 4) → **5.7 s per 100 sentences** |
| Cost | $0.060783 → **$0.00378 per 100**, $0.0378 per 1k, $3.78 per 100k |
| Reliability | 0 of 1607 sentences without a usable answer (0.00%) · 41 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 46 | 2 | 0.44 | 0.95 | 0.60 | 0.77 |
| unilateral_termination | 38 | 34 | 20 | 4 | 0.63 | 0.89 | 0.74 | 0.83 |
| unilateral_change | 38 | 36 | 27 | 2 | 0.57 | 0.95 | 0.71 | 0.84 |
| content_removal | 13 | 13 | 21 | 0 | 0.38 | 1.00 | 0.55 | 0.76 |
| contract_by_using | 23 | 17 | 4 | 6 | 0.81 | 0.74 | 0.77 | 0.75 |
| choice_of_law | 13 | 13 | 3 | 0 | 0.81 | 1.00 | 0.90 | 0.96 |
| jurisdiction | 16 | 16 | 1 | 0 | 0.94 | 1.00 | 0.97 | 0.99 |
| arbitration | 7 | 6 | 15 | 1 | 0.29 | 0.86 | 0.43 | 0.61 |
| **micro** | 186 | 171 | 137 | 15 | 0.56 | 0.92 | **0.69** | 0.81 |
| **sentence (any category)** | 172 | 162 | 120 | 10 | 0.57 | 0.94 | **0.71** | 0.84 |

Macro-F1: 0.71 · Exact label-set match: 90.85%

False-alarm rate (fair sentences flagged): 120 of 1435 = **8.36%**. Unlike precision, this does not depend on how many unfair sentences the sample has.



No threshold sweep: the LLM returns labels, not probabilities.
