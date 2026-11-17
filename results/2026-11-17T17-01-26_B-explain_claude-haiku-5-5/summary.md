# Re-explanation of pipeline B flags — results/2026-11-15T13-18-37_B_typesafe-jev-1-13

| | |
|---|---|
| Date | 2026-11-17T17:01:26.417Z |
| Model | anthropic/claude-haiku-5.5 (explanations only; Jev's flags unchanged) |
| Source run | `results/2026-11-15T13-18-37_B_typesafe-jev-1-13` |
| Rubric | v1.2 |
| Flagged sentences | 275 |
| Settings | 10 flagged sentences per call, concurrency 4 |
| Reliability | 0 of 275 without an explanation · 28 API calls · 0 malformed replies |
| Mean explanation length | 159 characters (source run: 155) |

## Stages

| stage | items | calls | failures | cost | wall-clock |
|---|---|---|---|---|---|
| llm-explain | 275 | 28 | 0 | $0.025912 | 49.9 s |

Cost per flag: $0.000094.

## Would the LLM veto the flag? (labels are not changed)

| | expert: unfair | expert: fair |
|---|---|---|
| LLM agrees | 158 | 83 |
| LLM disagrees | 2 | 32 |
