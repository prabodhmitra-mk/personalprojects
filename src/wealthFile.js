import { formatCurrency } from "./epfoParser.js";
import { calculateCompletedMonths } from "./pfProjection.js";

export const WEALTH_FILE_DB = "wealthDashboardFileDb";
export const WEALTH_FILE_STORE = "handles";
export const WEALTH_FILE_KEY = "primaryWealthFile";

export function createEmptyWealthData() {
  return {
    version: 1,
    lastUpdatedAt: new Date().toISOString(),
    pf: null,
    nps: null
  };
}

export function normalizeWealthData(value) {
  return {
    version: 1,
    lastUpdatedAt: value?.lastUpdatedAt || new Date().toISOString(),
    pf: value?.pf || null,
    nps: value?.nps || null
  };
}

export function buildPfRecord({ currentBalance, employeeContribution, employerContribution, savedAt = new Date().toISOString() }) {
  return {
    currentBalance: parseMoney(currentBalance),
    employeeContribution: parseMoney(employeeContribution),
    employerContribution: parseMoney(employerContribution),
    lastUpdatedAt: savedAt,
    lastCalculatedAt: savedAt,
    lastValidatedAt: null,
    source: "manual"
  };
}

export function buildNpsRecord(npsResult, updatedAt = new Date().toISOString()) {
  if (!npsResult) {
    return null;
  }

  return {
    totalValue: npsResult.totalValue,
    contributionTotal: npsResult.contributionTotal,
    pran: npsResult.pran,
    valueSource: npsResult.valueSource,
    confidence: npsResult.confidence,
    holdings: npsResult.holdings || [],
    lastUpdatedAt: updatedAt
  };
}

export function applyPfMonthlyEstimate(wealthData, asOf = new Date()) {
  const data = normalizeWealthData(JSON.parse(JSON.stringify(wealthData || createEmptyWealthData())));

  if (!data.pf) {
    return {
      data,
      estimate: null
    };
  }

  const anchor = new Date(data.pf.lastCalculatedAt || data.pf.lastUpdatedAt);
  const monthsElapsed = calculateCompletedMonths(anchor, asOf);
  const monthlyDeposit = roundMoney((data.pf.employeeContribution || 0) + (data.pf.employerContribution || 0));

  if (monthsElapsed < 1 || monthlyDeposit <= 0) {
    return {
      data,
      estimate: {
        applied: false,
        monthsElapsed,
        monthlyDeposit,
        previousBalance: data.pf.currentBalance,
        projectedBalance: data.pf.currentBalance
      }
    };
  }

  const previousBalance = data.pf.currentBalance || 0;
  const projectedBalance = roundMoney(previousBalance + monthsElapsed * monthlyDeposit);
  const calculatedThrough = addMonths(anchor, monthsElapsed);

  data.pf = {
    ...data.pf,
    currentBalance: projectedBalance,
    lastCalculatedAt: calculatedThrough.toISOString(),
    lastEstimatedAt: asOf.toISOString(),
    source: "estimated"
  };
  data.lastUpdatedAt = asOf.toISOString();

  return {
    data,
    estimate: {
      applied: true,
      monthsElapsed,
      monthlyDeposit,
      previousBalance,
      projectedBalance,
      calculatedThrough: calculatedThrough.toISOString()
    }
  };
}

export function createPfProjectionView(pfRecord, estimate = null, asOf = new Date()) {
  if (!pfRecord) {
    return null;
  }

  const monthlyDeposit = roundMoney((pfRecord.employeeContribution || 0) + (pfRecord.employerContribution || 0));

  return {
    currentBalance: pfRecord.currentBalance,
    employeeContribution: pfRecord.employeeContribution,
    employerContribution: pfRecord.employerContribution,
    savedAt: pfRecord.lastUpdatedAt || pfRecord.lastCalculatedAt || asOf.toISOString(),
    asOf: asOf.toISOString(),
    monthsElapsed: estimate?.applied ? estimate.monthsElapsed : 0,
    monthlyDeposit,
    projectedBalance: pfRecord.currentBalance,
    formattedProjectedBalance: formatCurrency(pfRecord.currentBalance)
  };
}

export async function storeWealthFileHandle(handle) {
  const db = await openHandleDb();
  await putStoreValue(db, WEALTH_FILE_KEY, handle);
}

export async function getStoredWealthFileHandle() {
  const db = await openHandleDb();
  return getStoreValue(db, WEALTH_FILE_KEY);
}

export async function clearStoredWealthFileHandle() {
  const db = await openHandleDb();
  await deleteStoreValue(db, WEALTH_FILE_KEY);
}

export async function verifyPermission(fileHandle, mode = "readwrite") {
  if (!fileHandle?.queryPermission || !fileHandle?.requestPermission) {
    return false;
  }

  const options = { mode };
  if ((await fileHandle.queryPermission(options)) === "granted") {
    return true;
  }

  return (await fileHandle.requestPermission(options)) === "granted";
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

function addMonths(date, months) {
  const copy = new Date(date.getTime());
  const day = copy.getDate();
  copy.setMonth(copy.getMonth() + months);

  if (copy.getDate() < day) {
    copy.setDate(0);
  }

  return copy;
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(WEALTH_FILE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(WEALTH_FILE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStoreValue(db, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WEALTH_FILE_STORE, "readonly");
    const request = transaction.objectStore(WEALTH_FILE_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function putStoreValue(db, key, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WEALTH_FILE_STORE, "readwrite");
    const request = transaction.objectStore(WEALTH_FILE_STORE).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteStoreValue(db, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WEALTH_FILE_STORE, "readwrite");
    const request = transaction.objectStore(WEALTH_FILE_STORE).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
