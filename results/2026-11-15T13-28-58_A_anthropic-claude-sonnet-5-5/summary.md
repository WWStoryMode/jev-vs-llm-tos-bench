# Pipeline A — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-15T13:28:58.079Z |
| Model | anthropic/claude-sonnet-5.5 |
| Rubric | v1.2 |
| Sentences | 400 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 24.3 s (concurrency 4) → **6.1 s per 100 sentences** |
| Cost | $0.238460 → **$0.05961 per 100**, $0.5961 per 1k, $59.61 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 10 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 12 | 2 | 0.75 | 0.95 | 0.84 | 0.90 |
| unilateral_termination | 38 | 31 | 4 | 7 | 0.89 | 0.82 | 0.85 | 0.83 |
| unilateral_change | 38 | 33 | 11 | 5 | 0.75 | 0.87 | 0.80 | 0.84 |
| content_removal | 13 | 13 | 6 | 0 | 0.68 | 1.00 | 0.81 | 0.92 |
| contract_by_using | 23 | 18 | 2 | 5 | 0.90 | 0.78 | 0.84 | 0.80 |
| choice_of_law | 13 | 13 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| jurisdiction | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| arbitration | 7 | 6 | 1 | 1 | 0.86 | 0.86 | 0.86 | 0.86 |
| **micro** | 186 | 166 | 36 | 20 | 0.82 | 0.89 | **0.86** | 0.88 |
| **sentence (any category)** | 172 | 161 | 18 | 11 | 0.90 | 0.94 | **0.92** | 0.93 |

Macro-F1: 0.87 · Exact label-set match: 87.50%

False-alarm rate (fair sentences flagged): 18 of 228 = **7.89%**. Unlike precision, this does not depend on how many unfair sentences the sample has.



No threshold sweep: the LLM returns labels, not probabilities.
