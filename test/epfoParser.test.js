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

test("parses EPFO overview current balance format", () => {
  const result = parsePassbookInput(`
    Select Member Id
    BGBNG18662230000010514
    Passbook Overview - BGBNG18662230000010514
    Current Balance Adjustments (Balance) Employee Contribution Employer Contribution Interest Earned Transfer-Ins/VDR Total PF Withdrawal
    Rs 13,17,956 Rs 0 Rs 3,05,452 Rs 2,86,702 Rs 71,255 Rs 0 Rs 0
    Last Contribution made by for the month of Jun-2026

    Passbook for Member Id : [ BGBNG18662230000010514 ]
    Particulars Employee Share Employer Share Pension Share
    OB Int. Updated upto 01/04/2026 Rs 6,13,073 Rs 5,71,715 Rs 37,500
    Wage Month Transaction Date Transaction Type Particulars EPF Wages EPS Wages Employee Share ( 12% ) Employer Share ( 3.67% ) Pension Share ( 8.33% )
    Mar-2026 01-04-2026 + Cont. for Due-Month 042026 1,65,360 15,000 19,843 18,593 1,250
    Apr-2026 01-05-2026 + Cont. for Due-Month 052026 2,02,566 15,000 24,308 23,058 1,250
    May-2026 01-06-2026 + Cont. for Due-Month 062026 2,02,566 15,000 24,308 23,058 1,250
    Total Contributions for the year [ 2026 ] Rs 68,459 Rs 64,709 Rs 3,750
    Closing Balance as on 31/03/2027 Rs 6,81,532 Rs 6,36,424 Rs 41,250
  `);

  assert.equal(result.totalBalance, 1317956);
  assert.equal(result.balanceSource, "overview-current-balance");
  assert.equal(result.records.length, 3);
  assert.equal(result.totals.employee, 68459);
  assert.equal(result.totals.employer, 64709);
  assert.equal(result.totals.pension, 3750);
});
