# Pipeline A — data/sample_400.jsonl

| | |
|---|---|
| Date | 2026-11-15T11:21:30.285Z |
| Model | anthropic/claude-sonnet-5.5 |
| Rubric | v1.1 |
| Sentences | 400 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 24.7 s (concurrency 4) → **6.2 s per 100 sentences** |
| Cost | $0.236560 → **$0.05914 per 100**, $0.5914 per 1k, $59.14 per 100k |
| Reliability | 0 of 400 sentences without a usable answer (0.00%) · 10 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 12 | 2 | 0.75 | 0.95 | 0.84 | 0.90 |
| unilateral_termination | 38 | 33 | 4 | 5 | 0.89 | 0.87 | 0.88 | 0.87 |
| unilateral_change | 38 | 34 | 13 | 4 | 0.72 | 0.89 | 0.80 | 0.85 |
| content_removal | 13 | 13 | 8 | 0 | 0.62 | 1.00 | 0.76 | 0.89 |
| contract_by_using | 23 | 19 | 2 | 4 | 0.90 | 0.83 | 0.86 | 0.84 |
| choice_of_law | 13 | 13 | 1 | 0 | 0.93 | 1.00 | 0.96 | 0.98 |
| jurisdiction | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| arbitration | 7 | 6 | 1 | 1 | 0.86 | 0.86 | 0.86 | 0.86 |
| **micro** | 186 | 170 | 41 | 16 | 0.81 | 0.91 | **0.86** | 0.89 |
| **sentence (any category)** | 172 | 164 | 21 | 8 | 0.89 | 0.95 | **0.92** | 0.94 |

Macro-F1: 0.87 · Exact label-set match: 87.00%

No threshold sweep: the LLM returns labels, not probabilities.
