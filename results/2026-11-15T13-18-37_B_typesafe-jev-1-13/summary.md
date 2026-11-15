# Pipeline B — data/unfair_tos_test.jsonl

| | |
|---|---|
| Date | 2026-11-15T13:18:37.392Z |
| Model | typesafe/jev-1.13 + anthropic/claude-sonnet-5.5 (explanations) |
| Rubric | v1.2 |
| Sentences | 1607 (172 unfair) |
| Threshold | 0.6 · explanations: 10 flagged sentences per call |
| Wall-clock | 103.2 s (concurrency 8, explain 4) → **6.4 s per 100 sentences** |
| Cost | $0.416248 → **$0.02590 per 100**, $0.2590 per 1k, $25.90 per 100k |
| Reliability | 0 of 1607 sentences without a usable answer (0.00%) · 1635 API calls · 0 HTTP retries · 0 malformed replies |

## Accuracy @ 0.6

| scope | support | TP | FP | FN | precision | recall | F1 | F2 |
|---|---|---|---|---|---|---|---|---|
| limitation_of_liability | 38 | 36 | 54 | 2 | 0.40 | 0.95 | 0.56 | 0.74 |
| unilateral_termination | 38 | 34 | 17 | 4 | 0.67 | 0.89 | 0.76 | 0.84 |
| unilateral_change | 38 | 33 | 28 | 5 | 0.54 | 0.87 | 0.67 | 0.77 |
| content_removal | 13 | 13 | 22 | 0 | 0.37 | 1.00 | 0.54 | 0.75 |
| contract_by_using | 23 | 18 | 4 | 5 | 0.82 | 0.78 | 0.80 | 0.79 |
| choice_of_law | 13 | 13 | 1 | 0 | 0.93 | 1.00 | 0.96 | 0.98 |
| jurisdiction | 16 | 15 | 6 | 1 | 0.71 | 0.94 | 0.81 | 0.88 |
| arbitration | 7 | 6 | 10 | 1 | 0.38 | 0.86 | 0.52 | 0.68 |
| **micro** | 186 | 168 | 142 | 18 | 0.54 | 0.90 | **0.68** | 0.80 |
| **sentence (any category)** | 172 | 160 | 115 | 12 | 0.58 | 0.93 | **0.72** | 0.83 |

Macro-F1: 0.70 · Exact label-set match: 90.60%

False-alarm rate (fair sentences flagged): 115 of 1435 = **8.01%**. Unlike precision, this does not depend on how many unfair sentences the sample has.

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| jev | 1607 | 1607 | 0 | $0.088074 | 64.1 s |
| llm-explain | 275 | 28 | 0 | $0.328174 | 39.1 s |
| **total** | | 1635 | | **$0.416248** | **103.2 s** |

## Explanations (step 3)

275 of 275 flagged sentences explained.

The LLM was also asked whether it agrees a flagged category applies. Labels were **not** changed; this shows what an LLM veto would do:

| | expert: unfair | expert: fair |
|---|---|---|
| LLM agrees | 158 | 84 |
| LLM disagrees (would veto) | 2 | 31 |

Sentence level with the veto: P 0.65, R 0.92, F1 0.76, F2 0.85 (without: P 0.58, R 0.93, F1 0.72, F2 0.83).

## Threshold sweep

| threshold | micro P | micro R | micro F1 | sentence P | sentence R | sentence F1 | sentence F2 | false-alarm rate |
|---|---|---|---|---|---|---|---|---|
| 0.3 | 0.36 | 0.96 | 0.53 | 0.41 | 0.97 | 0.58 | 0.76 | 16.79% |
| 0.4 | 0.43 | 0.96 | 0.59 | 0.47 | 0.97 | 0.63 | 0.80 | 13.24% |
| 0.5 | 0.48 | 0.92 | 0.64 | 0.52 | 0.95 | 0.67 | 0.82 | 10.38% |
| 0.6 | 0.54 | 0.90 | 0.68 | 0.58 | 0.93 | 0.72 | 0.83 | 8.01% |
| 0.7 | 0.59 | 0.87 | 0.70 | 0.63 | 0.92 | 0.75 | 0.84 | 6.48% |
| 0.8 | 0.66 | 0.81 | 0.73 | 0.69 | 0.85 | 0.76 | 0.81 | 4.67% |
| 0.9 | 0.78 | 0.69 | 0.73 | 0.80 | 0.73 | 0.76 | 0.74 | 2.16% |
