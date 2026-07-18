import assert from "node:assert/strict";
import test from "node:test";

import { parsePassbookInput } from "../src/epfoParser.js";

test("detects an explicit total balance", () => {
  const result = parsePassbookInput(`
    Employee Share Balance: Rs. 82,450
    Employer Share Balance: Rs. 71,220
    Pension Contribution: Rs. 23,180
    Total Balance: Rs. 1,76,850
  `);

  assert.equal(result.totalBalance, 176850);
  assert.equal(result.balanceSource, "labelled-total");
  assert.equal(result.components.employee, 82450);
  assert.equal(result.components.employer, 71220);
  assert.equal(result.components.pension, 23180);
});

test("sums balance components when there is no total label", () => {
  const result = parsePassbookInput(`
    EE Balance 10,000
    ER Balance 8,500
    EPS Balance 2,000
  `);

  assert.equal(result.totalBalance, 20500);
  assert.equal(result.balanceSource, "component-sum");
});

test("infers the last row balance from passbook rows", () => {
  const result = parsePassbookInput(`
    Wage Month Employee Share Employer Share Pension Share Balance
    Jan-2026 1,800 550 1,250 1,72,000
    Feb-2026 1,850 565 1,285 1,76,850
  `);

  assert.equal(result.totalBalance, 176850);
  assert.equal(result.balanceSource, "last-row-balance");
  assert.equal(result.records.length, 2);
});

test("normalizes simple html tables before parsing", () => {
  const result = parsePassbookInput(`
    <table>
      <tr><th>Label</th><th>Amount</th></tr>
      <tr><td>Total Balance</td><td>&#8377; 99,999</td></tr>
    </table>
  `);

  assert.equal(result.totalBalance, 99999);
});

test("aggregates employee and employer contributions across companies", () => {
  const result = parsePassbookInput(`
    Establishment ID & Name: ABC TECHNOLOGIES PRIVATE LIMITED
    Member ID: PYBOM00012340000001234
    Wage Month Employee Share Employer Share Pension Share Balance
    Jan-2026 1,800 550 1,250 1,72,000
    Feb-2026 1,850 565 1,285 1,76,850

    Establishment ID & Name: XYZ SERVICES LLP
    Member ID: MHBAN00056780000005678
    Wage Month EPF Wages EPS Wages EDLI Wages Employee Share Employer Share Pension Share Balance
    Jan-2026 15,000 15,000 15,000 1,800 550 1,250 90,000
    Feb-2026 15,500 15,000 15,500 1,860 570 1,290 95,500
  `);

  assert.equal(result.balanceSource, "company-balance-sum");
  assert.equal(result.totalBalance, 272350);
  assert.equal(result.totals.employee, 7310);
  assert.equal(result.totals.employer, 2235);
  assert.equal(result.totals.pension, 5075);
  assert.equal(result.companySummaries.length, 2);
  assert.deepEqual(
    result.companySummaries.map((summary) => [summary.company, summary.latestBalance]),
    [
      ["ABC TECHNOLOGIES PRIVATE LIMITED", 176850],
      ["XYZ SERVICES LLP", 95500]
    ]
  );
});
