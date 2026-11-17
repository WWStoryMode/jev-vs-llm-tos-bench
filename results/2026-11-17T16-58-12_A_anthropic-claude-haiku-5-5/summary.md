# Pipeline A — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-17T16:58:12.620Z |
| Model | anthropic/claude-haiku-5.5 |
| Rubric | v1.2 |
| Sentences | 400 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 35.0 s (concurrency 4) → **8.7 s per 100 sentences** |
| Cost | $0.019272 → **$0.00482 per 100**, $0.0482 per 1k, $4.82 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 10 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 7 | 2 | 0.84 | 0.95 | 0.89 | 0.92 |
| unilateral_termination | 38 | 32 | 5 | 6 | 0.86 | 0.84 | 0.85 | 0.85 |
| unilateral_change | 38 | 36 | 11 | 2 | 0.77 | 0.95 | 0.85 | 0.90 |
| content_removal | 13 | 13 | 8 | 0 | 0.62 | 1.00 | 0.76 | 0.89 |
| contract_by_using | 23 | 18 | 1 | 5 | 0.95 | 0.78 | 0.86 | 0.81 |
| choice_of_law | 13 | 13 | 1 | 0 | 0.93 | 1.00 | 0.96 | 0.98 |
| jurisdiction | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| arbitration | 7 | 6 | 5 | 1 | 0.55 | 0.86 | 0.67 | 0.77 |
| **micro** | 186 | 170 | 38 | 16 | 0.82 | 0.91 | **0.86** | 0.89 |
| **sentence (any category)** | 172 | 162 | 22 | 10 | 0.88 | 0.94 | **0.91** | 0.93 |

Macro-F1: 0.86 · Exact label-set match: 87.50%

False-alarm rate (fair sentences flagged): 22 of 228 = **9.65%**. Unlike precision, this does not depend on how many unfair sentences the sample has.



No threshold sweep: the LLM returns labels, not probabilities.
