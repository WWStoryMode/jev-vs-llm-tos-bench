// Self-test for src/metrics.ts on a hand-built fixture with known answers.
// Run:  npm run test-metrics
import assert from "node:assert/strict";
import { exactMatch, micro, perCategory, sentenceLevel, type Scored } from "../src/metrics.js";

const rows: Scored[] = [
  { id: "1", expert: ["a"], predicted: ["a"] }, //       a: TP
  { id: "2", expert: ["a"], predicted: [] }, //          a: FN
  { id: "3", expert: [], predicted: ["a"] }, //          a: FP
  { id: "4", expert: [], predicted: [] }, //             a: TN, b: TN
  { id: "5", expert: ["b"], predicted: ["a"] }, //       a: FP, b: FN   (sentence level: TP)
  { id: "6", expert: ["a", "b"], predicted: ["a", "b"] }, // a: TP, b: TP
  { id: "7", expert: ["b"], predicted: ["b"], failed: true }, // failed -> counts as nothing flagged: b FN
];

const cats = perCategory(rows, ["a", "b"]);
// a: TP=2 (1,6) FP=2 (3,5) FN=1 (2) TN=2 (4,7)
assert.deepEqual([cats.a!.tp, cats.a!.fp, cats.a!.fn, cats.a!.tn], [2, 2, 1, 2]);
assert.equal(cats.a!.precision, 0.5);
assert.equal(cats.a!.recall, 2 / 3);
assert.ok(Math.abs(cats.a!.f1 - 4 / 7) < 1e-12); // 2PR/(P+R) = (2*.5*.667)/(1.167)
// b: TP=1 (6) FN=2 (5,7) FP=0
assert.deepEqual([cats.b!.tp, cats.b!.fp, cats.b!.fn], [1, 0, 2]);
assert.equal(cats.b!.precision, 1);
assert.equal(cats.b!.recall, 1 / 3);
// F2 weights recall: 5PR/(4P+R) = (5*1*(1/3))/(4+1/3) = 5/13
assert.ok(Math.abs(cats.b!.f2 - 5 / 13) < 1e-12);

const m = micro(cats); // TP 3, FP 2, FN 3
assert.deepEqual([m.tp, m.fp, m.fn], [3, 2, 3]);
assert.equal(m.precision, 0.6);
assert.equal(m.recall, 0.5);

const s = sentenceLevel(rows); // unfair: 1,2,5,6,7 ; flagged: 1,3,5,6 (7 failed)
assert.deepEqual([s.tp, s.fp, s.fn, s.tn], [3, 1, 2, 1]);

assert.equal(exactMatch(rows), 3 / 7); // rows 1, 4, 6

console.log("metrics self-test passed");
