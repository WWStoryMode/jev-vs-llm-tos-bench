# Consistency — pipeline B, 3 runs, 400 sentences

Runs: `results/2026-11-15T13-27-08_B_typesafe-jev-1-13`, `results/2026-11-15T13-27-37_B_typesafe-jev-1-13`, `results/2026-11-15T13-28-07_B_typesafe-jev-1-13`

### Jev labels at threshold 0.5

| | |
|---|---|
| Sentences whose label set changed between runs | **5 of 400 (1.25%)** |
| Sentences whose flagged / not-flagged answer changed | 4 of 400 (1.00%) |

| run | sentence P | sentence R | sentence F1 |
|---|---|---|---|
| 1 | 0.876 | 0.942 | 0.908 |
| 2 | 0.867 | 0.948 | 0.906 |
| 3 | 0.876 | 0.948 | 0.911 |
| spread (max − min) | 0.009 | 0.006 | 0.005 |

Changed sentences:
- test-0013: [-] vs [unilateral_termination] vs [-]
- test-0542: [-] vs [-] vs [unilateral_change]
- test-0682: [unilateral_change, contract_by_using] vs [unilateral_change, contract_by_using] vs [unilateral_change]
- test-0953: [-] vs [contract_by_using] vs [-]
- test-1531: [-] vs [limitation_of_liability] vs [-]

### Jev labels at threshold 0.6

| | |
|---|---|
| Sentences whose label set changed between runs | **3 of 400 (0.75%)** |
| Sentences whose flagged / not-flagged answer changed | 2 of 400 (0.50%) |

| run | sentence P | sentence R | sentence F1 |
|---|---|---|---|
| 1 | 0.894 | 0.930 | 0.912 |
| 2 | 0.894 | 0.930 | 0.912 |
| 3 | 0.894 | 0.930 | 0.912 |
| spread (max − min) | 0.000 | 0.000 | 0.000 |

Changed sentences:
- test-0186: [-] vs [unilateral_change] vs [-]
- test-0741: [unilateral_change] vs [unilateral_termination, unilateral_change] vs [unilateral_change]
- test-1076: [limitation_of_liability] vs [-] vs [limitation_of_liability]

### Jev probability spread across runs (3200 sentence × category pairs)

| identical | median | 95th percentile | 99th percentile | max |
|---|---|---|---|---|
| 73.4% | 0.000 | 0.010 | 0.040 | 0.090 |

Pairs with a probability within ±0.05 of the threshold in any run: 21 at 0.5, 18 at 0.6. These are the only ones that can plausibly flip.
