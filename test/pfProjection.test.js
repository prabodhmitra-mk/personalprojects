import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCompletedMonths,
  calculatePfProjection,
  createPfProjectionBaseline
} from "../src/pfProjection.js";

test("calculates completed months between saved baseline and current date", () => {
  assert.equal(
    calculateCompletedMonths(new Date("2026-01-15T00:00:00Z"), new Date("2026-04-14T00:00:00Z")),
    2
  );
  assert.equal(
    calculateCompletedMonths(new Date("2026-01-15T00:00:00Z"), new Date("2026-04-15T00:00:00Z")),
    3
  );
});

test("projects PF balance using same employee and employer monthly deposits", () => {
  const baseline = createPfProjectionBaseline({
    currentBalance: "13,17,956",
    employeeContribution: "24,308",
    employerContribution: "23,058",
    savedAt: "2026-01-15T00:00:00.000Z"
  });
  const projection = calculatePfProjection(baseline, new Date("2026-04-15T00:00:00.000Z"));

  assert.equal(projection.monthlyDeposit, 47366);
  assert.equal(projection.monthsElapsed, 3);
  assert.equal(projection.projectedBalance, 1460054);
});
