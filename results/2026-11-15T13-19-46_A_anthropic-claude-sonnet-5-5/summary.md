# Pipeline A — data/unfair_tos_test.jsonl

| | |
|---|---|
| Date | 2026-11-15T13:19:46.667Z |
| Model | anthropic/claude-sonnet-5.5 |
| Rubric | v1.2 |
| Sentences | 1607 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 68.6 s (concurrency 4) → **4.3 s per 100 sentences** |
| Cost | $0.820110 → **$0.05103 per 100**, $0.5103 per 1k, $51.03 per 100k |
| Reliability | 0 of 1607 sentences without a usable answer (0.00%) · 42 API calls · 0 HTTP retries · 1 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 63 | 2 | 0.36 | 0.95 | 0.53 | 0.72 |
| unilateral_termination | 38 | 33 | 15 | 5 | 0.69 | 0.87 | 0.77 | 0.83 |
| unilateral_change | 38 | 33 | 22 | 5 | 0.60 | 0.87 | 0.71 | 0.80 |
| content_removal | 13 | 12 | 17 | 1 | 0.41 | 0.92 | 0.57 | 0.74 |
| contract_by_using | 23 | 18 | 7 | 5 | 0.72 | 0.78 | 0.75 | 0.77 |
| choice_of_law | 13 | 13 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| jurisdiction | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| arbitration | 7 | 6 | 13 | 1 | 0.32 | 0.86 | 0.46 | 0.64 |
| **micro** | 186 | 167 | 137 | 19 | 0.55 | 0.90 | **0.68** | 0.80 |
| **sentence (any category)** | 172 | 161 | 117 | 11 | 0.58 | 0.94 | **0.72** | 0.83 |

Macro-F1: 0.72 · Exact label-set match: 90.60%

False-alarm rate (fair sentences flagged): 117 of 1435 = **8.15%**. Unlike precision, this does not depend on how many unfair sentences the sample has.



No threshold sweep: the LLM returns labels, not probabilities.
