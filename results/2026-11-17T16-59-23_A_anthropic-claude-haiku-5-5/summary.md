# Pipeline A — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-17T16:59:23.640Z |
| Model | anthropic/claude-haiku-5.5 |
| Rubric | v1.2 |
| Sentences | 400 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 33.1 s (concurrency 4) → **8.3 s per 100 sentences** |
| Cost | $0.019024 → **$0.00476 per 100**, $0.0476 per 1k, $4.76 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 10 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 37 | 7 | 1 | 0.84 | 0.97 | 0.90 | 0.94 |
| unilateral_termination | 38 | 31 | 3 | 7 | 0.91 | 0.82 | 0.86 | 0.83 |
| unilateral_change | 38 | 35 | 9 | 3 | 0.80 | 0.92 | 0.85 | 0.89 |
| content_removal | 13 | 13 | 9 | 0 | 0.59 | 1.00 | 0.74 | 0.88 |
| contract_by_using | 23 | 18 | 1 | 5 | 0.95 | 0.78 | 0.86 | 0.81 |
| choice_of_law | 13 | 13 | 1 | 0 | 0.93 | 1.00 | 0.96 | 0.98 |
| jurisdiction | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| arbitration | 7 | 6 | 3 | 1 | 0.67 | 0.86 | 0.75 | 0.81 |
| **micro** | 186 | 169 | 33 | 17 | 0.84 | 0.91 | **0.87** | 0.89 |
| **sentence (any category)** | 172 | 162 | 21 | 10 | 0.89 | 0.94 | **0.91** | 0.93 |

Macro-F1: 0.87 · Exact label-set match: 88.00%

False-alarm rate (fair sentences flagged): 21 of 228 = **9.21%**. Unlike precision, this does not depend on how many unfair sentences the sample has.



No threshold sweep: the LLM returns labels, not probabilities.
