import assert from "node:assert/strict";
import test from "node:test";

import { parseNpsInput } from "../src/npsParser.js";

test("detects labelled NPS corpus and contribution", () => {
  const result = parseNpsInput(`
    NPS Holdings Statement
    PRAN: 110012345678
    Total Contribution: Rs 4,20,000
    Total NPS Corpus: Rs 5,84,250
  `);

  assert.equal(result.totalValue, 584250);
  assert.equal(result.valueSource, "labelled-total");
  assert.equal(result.contributionTotal, 420000);
  assert.equal(result.pran, "110012345678");
});

test("sums detected NPS holdings when no labelled total is present", () => {
  const result = parseNpsInput(`
    Tier I Scheme Units NAV Current Value
    Tier I Equity Scheme E 1,250.0000 62.50 78,125
    Tier I Corporate Bond Scheme C 3,100.0000 38.75 1,20,125
    Tier I Government Securities Scheme G 7,800.0000 49.50 3,86,000
  `);

  assert.equal(result.totalValue, 584250);
  assert.equal(result.valueSource, "holding-sum");
  assert.equal(result.holdings.length, 3);
  assert.deepEqual(
    result.holdings.map((holding) => holding.value),
    [78125, 120125, 386000]
  );
});
