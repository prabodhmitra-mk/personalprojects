export const PF_PROJECTION_STORAGE_KEY = "epfoProjectionBaseline";

export function createPfProjectionBaseline({
  currentBalance,
  employeeContribution,
  employerContribution,
  savedAt = new Date().toISOString()
}) {
  return {
    currentBalance: parseMoney(currentBalance),
    employeeContribution: parseMoney(employeeContribution),
    employerContribution: parseMoney(employerContribution),
    savedAt
  };
}

export function calculatePfProjection(baseline, asOf = new Date()) {
  if (!baseline) {
    return null;
  }

  const savedAt = new Date(baseline.savedAt);
  const monthsElapsed = calculateCompletedMonths(savedAt, asOf);
  const monthlyDeposit = roundMoney((baseline.employeeContribution || 0) + (baseline.employerContribution || 0));
  const projectedBalance = roundMoney((baseline.currentBalance || 0) + monthsElapsed * monthlyDeposit);

  return {
    ...baseline,
    savedAt: savedAt.toISOString(),
    asOf: asOf.toISOString(),
    monthsElapsed,
    monthlyDeposit,
    projectedBalance
  };
}

export function calculateCompletedMonths(fromDate, toDate) {
  if (!(fromDate instanceof Date) || !(toDate instanceof Date) || Number.isNaN(fromDate) || Number.isNaN(toDate)) {
    return 0;
  }

  if (toDate <= fromDate) {
    return 0;
  }

  let months = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());

  if (toDate.getDate() < fromDate.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

export function parseMoney(value) {
  const amount = typeof value === "number"
    ? value
    : Number.parseFloat(String(value || "").replace(/(?:rs\.?|inr|₹)/gi, "").replace(/,/g, "").trim());

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter valid non-negative PF balance and contribution amounts.");
  }

  return roundMoney(amount);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
