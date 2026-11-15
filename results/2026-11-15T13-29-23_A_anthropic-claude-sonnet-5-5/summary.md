# Pipeline A — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-15T13:29:23.962Z |
| Model | anthropic/claude-sonnet-5.5 |
| Rubric | v1.2 |
| Sentences | 400 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 25.4 s (concurrency 4) → **6.3 s per 100 sentences** |
| Cost | $0.263308 → **$0.06583 per 100**, $0.6583 per 1k, $65.83 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 11 API calls · 0 HTTP retries · 1 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 12 | 2 | 0.75 | 0.95 | 0.84 | 0.90 |
| unilateral_termination | 38 | 33 | 5 | 5 | 0.87 | 0.87 | 0.87 | 0.87 |
| unilateral_change | 38 | 34 | 13 | 4 | 0.72 | 0.89 | 0.80 | 0.85 |
| content_removal | 13 | 13 | 8 | 0 | 0.62 | 1.00 | 0.76 | 0.89 |
| contract_by_using | 23 | 18 | 3 | 5 | 0.86 | 0.78 | 0.82 | 0.80 |
| choice_of_law | 13 | 13 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| jurisdiction | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| arbitration | 7 | 6 | 3 | 1 | 0.67 | 0.86 | 0.75 | 0.81 |
| **micro** | 186 | 169 | 44 | 17 | 0.79 | 0.91 | **0.85** | 0.88 |
| **sentence (any category)** | 172 | 161 | 23 | 11 | 0.88 | 0.94 | **0.90** | 0.92 |

Macro-F1: 0.85 · Exact label-set match: 86.00%

False-alarm rate (fair sentences flagged): 23 of 228 = **10.09%**. Unlike precision, this does not depend on how many unfair sentences the sample has.



No threshold sweep: the LLM returns labels, not probabilities.
