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

test("parses actual NPS transaction statement investment summary layout", () => {
  const result = parseNpsInput(`
    NPS TRANSACTION STATEMENT
    PRAN 110083831283
    Investment Summary
    Total
    Value of your Total Total Notional Withdrawal/
    Contribution in
    Holdings(Invest Withdrawal as Gain/Loss as deduction in
    No of your account as Return on
    ments) on on units towards
    Contributions on Investment 9.34%
    as on July 06, July 06, 2026 (in July 06, 2026 (in intermediary
    July 06, 2026 (in (XIRR)
    2026 (in ₹) ₹) ₹) charges (in ₹)
    ₹)
    (A) (B) (C) D=(A-B)+C E
    ₹ 15,13,431.19 78 ₹ 10,17,200.66 ₹ 0.00 ₹ 4,96,230.53 ₹ 177.00
    Investment Details - Scheme Wise Summary
    Scheme wise Value of
    your NAV as on 03-Jul-2026 ( N
    Particulars Total Units ( U )
    Holdings(Investments) (in )
    ₹) (E = U * N)
    SBI PENSION FUND SCHEME E - TIER I POP 4,95,029.90 8,716.2513 56.7939
    SBI PENSION FUND SCHEME C - TIER I POP 3,37,338.48 7,230.3809 46.6557
    SBI PENSION FUND SCHEME G - TIER I POP 6,81,062.81 16,046.0372 42.4443
  `);

  assert.equal(result.totalValue, 1513431.19);
  assert.equal(result.valueSource, "investment-summary");
  assert.equal(result.contributionTotal, 1017200.66);
  assert.equal(result.pran, "110083831283");
  assert.equal(result.holdings.length, 3);
  assert.deepEqual(
    result.holdings.map((holding) => holding.value),
    [495029.9, 337338.48, 681062.81]
  );
  assert.deepEqual(
    result.holdings.map((holding) => holding.units),
    [8716.2513, 7230.3809, 16046.0372]
  );
  assert.equal(result.holdings[0].scheme, "SBI PENSION FUND SCHEME E - TIER I POP");
});
