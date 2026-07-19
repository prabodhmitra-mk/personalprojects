import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPfMonthlyEstimate,
  buildPfRecord,
  createPfProjectionView
} from "../src/wealthFile.js";

test("does not estimate PF when less than one full month elapsed", () => {
  const wealthData = {
    version: 1,
    pf: buildPfRecord({
      currentBalance: 100000,
      employeeContribution: 1000,
      employerContribution: 900,
      savedAt: "2026-01-15T00:00:00.000Z"
    })
  };
  const result = applyPfMonthlyEstimate(wealthData, new Date("2026-02-14T00:00:00.000Z"));

  assert.equal(result.estimate.applied, false);
  assert.equal(result.data.pf.currentBalance, 100000);
});

test("estimates PF when one or more full months elapsed", () => {
  const wealthData = {
    version: 1,
    pf: buildPfRecord({
      currentBalance: 100000,
      employeeContribution: 1000,
      employerContribution: 900,
      savedAt: "2026-01-15T00:00:00.000Z"
    })
  };
  const result = applyPfMonthlyEstimate(wealthData, new Date("2026-04-16T00:00:00.000Z"));

  assert.equal(result.estimate.applied, true);
  assert.equal(result.estimate.monthsElapsed, 3);
  assert.equal(result.data.pf.currentBalance, 105700);
});

test("creates PF projection view from stored wealth data", () => {
  const pf = buildPfRecord({
    currentBalance: 100000,
    employeeContribution: 1000,
    employerContribution: 900,
    savedAt: "2026-01-15T00:00:00.000Z"
  });
  const view = createPfProjectionView(pf, null, new Date("2026-01-20T00:00:00.000Z"));

  assert.equal(view.monthlyDeposit, 1900);
  assert.equal(view.projectedBalance, 100000);
});
