export const GOOGLE_SHEETS_SETTINGS_KEY = "portfolioGoogleSheetsSettings";

export function buildPortfolioExportPayload({
  spreadsheetId = "",
  spreadsheetName = "PF NPS Portfolio Tracker",
  pfProjection = null,
  npsResult = null,
  updatedAt = new Date().toISOString()
}) {
  const pfValue = pfProjection?.projectedBalance ?? null;
  const npsValue = npsResult?.totalValue ?? null;
  const combinedValue = sumNullable([pfValue, npsValue]);

  return {
    spreadsheetId,
    spreadsheetName,
    updatedAt,
    summaryRows: [
      ["Metric", "Value", "Last Updated"],
      ["Projected PF Value", pfValue, updatedAt],
      ["NPS Value", npsValue, updatedAt],
      ["Combined PF + NPS Value", combinedValue, updatedAt]
    ],
    pfProjectionRows: [
      ["Metric", "Value"],
      ["Saved baseline current balance", pfProjection?.currentBalance ?? null],
      ["Last month employee contribution", pfProjection?.employeeContribution ?? null],
      ["Last month employer contribution", pfProjection?.employerContribution ?? null],
      ["Assumed monthly deposit", pfProjection?.monthlyDeposit ?? null],
      ["Saved at", pfProjection?.savedAt ?? ""],
      ["Projection as of", pfProjection?.asOf ?? ""],
      ["Completed months elapsed", pfProjection?.monthsElapsed ?? null],
      ["Projected PF balance", pfProjection?.projectedBalance ?? null],
      ["Validation recommendation", pfProjection ? "Optional but recommended: manually log into EPFO and compare with official current balance" : ""]
    ],
    npsSummaryRows: [
      ["Metric", "Value"],
      ["Total NPS value", npsResult?.totalValue ?? null],
      ["Total contribution", npsResult?.contributionTotal ?? null],
      ["PRAN", npsResult?.pran ?? ""],
      ["Detection source", npsResult?.valueSource ?? ""],
      ["Parser confidence", npsResult ? `${Math.round(npsResult.confidence * 100)}%` : ""]
    ],
    npsHoldingsRows: [
      ["Tier", "Scheme", "Units", "NAV", "Current Value", "Raw"],
      ...((npsResult?.holdings || []).map((holding) => [
        holding.tier || "",
        holding.scheme,
        holding.units,
        holding.nav,
        holding.value,
        holding.raw
      ]))
    ],
    historyRow: [
      updatedAt,
      pfValue,
      npsValue,
      combinedValue,
      pfProjection ? "PF projection" : "",
      npsResult ? "NPS imported" : ""
    ]
  };
}

function sumNullable(values) {
  const presentValues = values.filter((value) => value !== null && value !== undefined);
  if (presentValues.length === 0) {
    return null;
  }

  return presentValues.reduce((total, value) => total + value, 0);
}
