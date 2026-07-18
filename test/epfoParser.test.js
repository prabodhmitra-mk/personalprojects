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
