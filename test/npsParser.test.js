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

test("parses NPS SOT style valuation and multiline holdings", () => {
  const result = parseNpsInput(`
    Statement of Transaction
    PRAN 110083831283
    Total Contribution Received
    1,50,000.00
    Total Corpus as on 31/03/2026
    1,98,250.00

    Tier I Scheme Units NAV Current Value
    HDFC Pension Fund Scheme E - Tier I
    1,250.0000 62.5000 78,125.00
    SBI Pension Fund Scheme C - Tier I 3,100.0000 38.7500 1,20,125.00
  `);

  assert.equal(result.totalValue, 198250);
  assert.equal(result.contributionTotal, 150000);
  assert.equal(result.pran, "110083831283");
  assert.equal(result.holdings.length, 2);
  assert.deepEqual(
    result.holdings.map((holding) => holding.value),
    [78125, 120125]
  );
});

test("does not treat dates as amounts in NPS total lines", () => {
  const result = parseNpsInput(`
    Current Valuation as on 31/03/2026
    2,45,000.50
  `);

  assert.equal(result.totalValue, 245000.5);
});
