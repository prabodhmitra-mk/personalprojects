import assert from "node:assert/strict";
import test from "node:test";

import { buildPortfolioExportPayload } from "../src/portfolioExport.js";

test("builds Google Sheets payload with PF, NPS, summary, and history rows", () => {
  const payload = buildPortfolioExportPayload({
    spreadsheetId: "sheet-123",
    updatedAt: "2026-07-19T10:00:00.000Z",
    pfProjection: {
      currentBalance: 100000,
      employeeContribution: 1000,
      employerContribution: 900,
      monthlyDeposit: 1900,
      savedAt: "2026-06-01T00:00:00.000Z",
      asOf: "2026-07-19T10:00:00.000Z",
      monthsElapsed: 1,
      projectedBalance: 101900
    },
    npsResult: {
      totalValue: 50000,
      contributionTotal: 40000,
      pran: "110012345678",
      valueSource: "labelled-total",
      confidence: 0.9,
      holdings: [
        {
          tier: "Tier I",
          scheme: "Equity Scheme E",
          units: 100,
          nav: 50,
          value: 5000,
          raw: "Tier I Equity Scheme E 100 50 5000"
        }
      ]
    }
  });

  assert.equal(payload.spreadsheetId, "sheet-123");
  assert.deepEqual(payload.summaryRows[1], ["Projected PF Value", 101900, "2026-07-19T10:00:00.000Z"]);
  assert.deepEqual(payload.summaryRows[2], ["NPS Value", 50000, "2026-07-19T10:00:00.000Z"]);
  assert.deepEqual(payload.summaryRows[3], ["Combined PF + NPS Value", 151900, "2026-07-19T10:00:00.000Z"]);
  assert.deepEqual(payload.historyRow, [
    "2026-07-19T10:00:00.000Z",
    101900,
    50000,
    151900,
    "PF projection",
    "NPS imported"
  ]);
  assert.equal(payload.npsHoldingsRows.length, 2);
});
