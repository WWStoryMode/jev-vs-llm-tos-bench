# Pipeline A — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-17T16:58:48.932Z |
| Model | anthropic/claude-haiku-5.5 |
| Rubric | v1.2 |
| Sentences | 400 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 34.4 s (concurrency 4) → **8.6 s per 100 sentences** |
| Cost | $0.019137 → **$0.00478 per 100**, $0.0478 per 1k, $4.78 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 10 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 33 | 8 | 5 | 0.80 | 0.87 | 0.84 | 0.85 |
| unilateral_termination | 38 | 33 | 5 | 5 | 0.87 | 0.87 | 0.87 | 0.87 |
| unilateral_change | 38 | 35 | 9 | 3 | 0.80 | 0.92 | 0.85 | 0.89 |
| content_removal | 13 | 13 | 8 | 0 | 0.62 | 1.00 | 0.76 | 0.89 |
| contract_by_using | 23 | 17 | 1 | 6 | 0.94 | 0.74 | 0.83 | 0.77 |
| choice_of_law | 13 | 13 | 1 | 0 | 0.93 | 1.00 | 0.96 | 0.98 |
| jurisdiction | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| arbitration | 7 | 6 | 4 | 1 | 0.60 | 0.86 | 0.71 | 0.79 |
| **micro** | 186 | 166 | 36 | 20 | 0.82 | 0.89 | **0.86** | 0.88 |
| **sentence (any category)** | 172 | 158 | 21 | 14 | 0.88 | 0.92 | **0.90** | 0.91 |

Macro-F1: 0.85 · Exact label-set match: 87.00%

False-alarm rate (fair sentences flagged): 21 of 228 = **9.21%**. Unlike precision, this does not depend on how many unfair sentences the sample has.



No threshold sweep: the LLM returns labels, not probabilities.
