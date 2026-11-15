# Pipeline A — data/unfair_tos_test.jsonl

| | |
|---|---|
| Date | 2026-11-15T12:47:31.001Z |
| Model | anthropic/claude-sonnet-5.5 |
| Rubric | v1.1 |
| Sentences | 1607 (172 unfair) |
| Batch size | 40 consecutive sentences per call |
| Wall-clock | 68.1 s (concurrency 4) → **4.2 s per 100 sentences** |
| Cost | $0.805112 → **$0.05010 per 100**, $0.5010 per 1k, $50.10 per 100k |
| Reliability | 0 of 1607 sentences without a usable answer (0.00%) · 41 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 97 | 2 | 0.27 | 0.95 | 0.42 | 0.63 |
| unilateral_termination | 38 | 31 | 17 | 7 | 0.65 | 0.82 | 0.72 | 0.78 |
| unilateral_change | 38 | 33 | 26 | 5 | 0.56 | 0.87 | 0.68 | 0.78 |
| content_removal | 13 | 13 | 17 | 0 | 0.43 | 1.00 | 0.60 | 0.79 |
| contract_by_using | 23 | 21 | 11 | 2 | 0.66 | 0.91 | 0.76 | 0.85 |
| choice_of_law | 13 | 13 | 1 | 0 | 0.93 | 1.00 | 0.96 | 0.98 |
| jurisdiction | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| arbitration | 7 | 6 | 13 | 1 | 0.32 | 0.86 | 0.46 | 0.64 |
| **micro** | 186 | 169 | 182 | 17 | 0.48 | 0.91 | **0.63** | 0.77 |
| **sentence (any category)** | 172 | 164 | 163 | 8 | 0.50 | 0.95 | **0.66** | 0.81 |

Macro-F1: 0.70 · Exact label-set match: 87.93%



No threshold sweep: the LLM returns labels, not probabilities.
