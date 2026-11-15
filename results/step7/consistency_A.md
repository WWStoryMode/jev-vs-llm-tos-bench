# Consistency — pipeline A, 3 runs, 400 sentences

Runs: `results/2026-11-15T13-28-33_A_anthropic-claude-sonnet-5-5`, `results/2026-11-15T13-28-58_A_anthropic-claude-sonnet-5-5`, `results/2026-11-15T13-29-23_A_anthropic-claude-sonnet-5-5`

### LLM labels

| | |
|---|---|
| Sentences whose label set changed between runs | **20 of 400 (5.00%)** |
| Sentences whose flagged / not-flagged answer changed | 8 of 400 (2.00%) |

| run | sentence P | sentence R | sentence F1 |
|---|---|---|---|
| 1 | 0.894 | 0.936 | 0.915 |
| 2 | 0.899 | 0.936 | 0.917 |
| 3 | 0.875 | 0.936 | 0.904 |
| spread (max − min) | 0.024 | 0.000 | 0.013 |

Changed sentences (first 15):
- test-0056: [unilateral_change, unilateral_termination] vs [unilateral_change] vs [unilateral_change, unilateral_termination]
- test-0067: [unilateral_termination] vs [unilateral_termination] vs [unilateral_termination, unilateral_change]
- test-0524: [content_removal] vs [content_removal, limitation_of_liability] vs [content_removal]
- test-0528: [content_removal, limitation_of_liability] vs [content_removal, unilateral_termination, limitation_of_liability] vs [content_removal, limitation_of_liability]
- test-0611: [unilateral_termination, unilateral_change] vs [unilateral_termination] vs [unilateral_termination, unilateral_change]
- test-0615: [unilateral_termination, unilateral_change] vs [unilateral_termination] vs [unilateral_termination, unilateral_change]
- test-0744: [-] vs [-] vs [limitation_of_liability]
- test-0855: [contract_by_using] vs [contract_by_using, unilateral_change] vs [contract_by_using, unilateral_change]
- test-0863: [unilateral_change] vs [unilateral_change] vs [unilateral_change, unilateral_termination]
- test-0887: [-] vs [limitation_of_liability] vs [limitation_of_liability]
- test-0913: [limitation_of_liability, content_removal] vs [limitation_of_liability, content_removal] vs [limitation_of_liability, unilateral_termination, content_removal]
- test-0914: [limitation_of_liability] vs [-] vs [-]
- test-1081: [-] vs [limitation_of_liability] vs [limitation_of_liability]
- test-1195: [unilateral_change] vs [-] vs [unilateral_change]
- test-1200: [limitation_of_liability, content_removal] vs [limitation_of_liability] vs [limitation_of_liability, content_removal]
