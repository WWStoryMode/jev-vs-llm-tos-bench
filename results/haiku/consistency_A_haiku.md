# Consistency — pipeline A, 3 runs, 400 sentences

Runs: `results/2026-11-17T16-58-12_A_anthropic-claude-haiku-5-5`, `results/2026-11-17T16-58-48_A_anthropic-claude-haiku-5-5`, `results/2026-11-17T16-59-23_A_anthropic-claude-haiku-5-5`

### LLM labels

| | |
|---|---|
| Sentences whose label set changed between runs | **23 of 400 (5.75%)** |
| Sentences whose flagged / not-flagged answer changed | 10 of 400 (2.50%) |

| run | sentence P | sentence R | sentence F1 |
|---|---|---|---|
| 1 | 0.880 | 0.942 | 0.910 |
| 2 | 0.883 | 0.919 | 0.900 |
| 3 | 0.885 | 0.942 | 0.913 |
| spread (max − min) | 0.005 | 0.023 | 0.012 |

Changed sentences (first 15):
- test-0408: [unilateral_change] vs [-] vs [unilateral_change]
- test-0541: [unilateral_change, unilateral_termination] vs [unilateral_change, unilateral_termination] vs [unilateral_change]
- test-0542: [unilateral_change, unilateral_termination] vs [unilateral_change, unilateral_termination] vs [unilateral_change]
- test-0594: [content_removal, limitation_of_liability] vs [content_removal, limitation_of_liability] vs [content_removal]
- test-0611: [unilateral_termination, unilateral_change] vs [unilateral_termination] vs [unilateral_termination]
- test-0615: [unilateral_termination, unilateral_change] vs [unilateral_termination] vs [unilateral_termination]
- test-0652: [unilateral_change] vs [-] vs [-]
- test-0739: [unilateral_change] vs [unilateral_change, unilateral_termination] vs [unilateral_termination, unilateral_change]
- test-0741: [unilateral_change] vs [unilateral_change, unilateral_termination] vs [unilateral_termination, unilateral_change]
- test-0750: [limitation_of_liability] vs [-] vs [limitation_of_liability]
- test-0751: [limitation_of_liability] vs [-] vs [limitation_of_liability]
- test-0858: [contract_by_using] vs [unilateral_change] vs [unilateral_change, contract_by_using]
- test-0863: [unilateral_change, unilateral_termination] vs [unilateral_change, unilateral_termination] vs [unilateral_change]
- test-0887: [-] vs [limitation_of_liability] vs [limitation_of_liability]
- test-0913: [limitation_of_liability, unilateral_termination, content_removal] vs [limitation_of_liability, unilateral_termination, content_removal] vs [limitation_of_liability, content_removal]
