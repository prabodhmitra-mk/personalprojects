import { formatCurrency } from "./epfoParser.js";
import { parseNpsInput } from "./npsParser.js";
import {
  applyPfMonthlyEstimate,
  buildNpsRecord,
  buildPfRecord,
  buildPpfRecord,
  clearStoredWealthFileHandle,
  createEmptyWealthData,
  createPfProjectionView,
  getStoredWealthFileHandle,
  normalizeWealthData,
  storeWealthFileHandle,
  verifyPermission
} from "./wealthFile.js";

const EPFO_PASSBOOK_URL = "https://passbook.epfindia.gov.in/MemberPassBook/Login";
const createWealthFileButton = document.querySelector("#create-wealth-file");
const openWealthFileButton = document.querySelector("#open-wealth-file");
const saveWealthFileButton = document.querySelector("#save-wealth-file");
const acceptPfEstimateButton = document.querySelector("#accept-pf-estimate");
const wealthFileStatus = document.querySelector("#wealth-file-status");
const npsInput = document.querySelector("#nps-input");
const importNpsEmailButton = document.querySelector("#import-nps-email");
const clearNpsButton = document.querySelector("#clear-nps");
const downloadXlsButton = document.querySelector("#download-xls");
const npsStatusMessage = document.querySelector("#nps-status-message");
const npsEmailStatusMessage = document.querySelector("#nps-email-status-message");
const npsEmailHost = document.querySelector("#nps-email-host");
const npsEmailPort = document.querySelector("#nps-email-port");
const npsEmailUsername = document.querySelector("#nps-email-username");
const npsEmailPassword = document.querySelector("#nps-email-password");
const npsEmailMailbox = document.querySelector("#nps-email-mailbox");
const npsEmailSubject = document.querySelector("#nps-email-subject");
const npsEmailSinceDays = document.querySelector("#nps-email-since-days");
const npsEmailScanLimit = document.querySelector("#nps-email-scan-limit");
const npsAttachmentPassword = document.querySelector("#nps-attachment-password");
const pfBaselineBalance = document.querySelector("#pf-baseline-balance");
const pfBaselineEmployee = document.querySelector("#pf-baseline-employee");
const pfBaselineEmployer = document.querySelector("#pf-baseline-employer");
const savePfProjectionButton = document.querySelector("#save-pf-projection");
const validatePfProjectionButton = document.querySelector("#validate-pf-projection");
const clearPfProjectionButton = document.querySelector("#clear-pf-projection");
const pfProjectionStatus = document.querySelector("#pf-projection-status");
const ppfBalance = document.querySelector("#ppf-balance");
const ppfYearlyContribution = document.querySelector("#ppf-yearly-contribution");
const ppfAccountLabel = document.querySelector("#ppf-account-label");
const ppfNotes = document.querySelector("#ppf-notes");
const savePpfButton = document.querySelector("#save-ppf");
const clearPpfButton = document.querySelector("#clear-ppf");
const ppfStatus = document.querySelector("#ppf-status");
const dashboard = document.querySelector("#dashboard");
const portfolioTotal = document.querySelector("#portfolio-total");
const pfProjectedBalance = document.querySelector("#pf-projected-balance");
const pfProjectionMonthlyDeposit = document.querySelector("#pf-projection-monthly-deposit");
const pfProjectionMonths = document.querySelector("#pf-projection-months");
const npsTotalValue = document.querySelector("#nps-total-value");
const npsContributionTotal = document.querySelector("#nps-contribution-total");
const npsConfidence = document.querySelector("#nps-confidence");
const npsSource = document.querySelector("#nps-source");
const ppfTotalValue = document.querySelector("#ppf-total-value");
const ppfUpdatedAt = document.querySelector("#ppf-updated-at");
const npsHoldingList = document.querySelector("#nps-holding-list");
const npsWarningList = document.querySelector("#nps-warning-list");

let wealthFileHandle = null;
let wealthData = createEmptyWealthData();
let pendingPfEstimate = null;
let pfProjection = null;
let lastNpsResult = null;

createWealthFileButton.addEventListener("click", createWealthFile);
openWealthFileButton.addEventListener("click", openWealthFile);
saveWealthFileButton.addEventListener("click", () => saveWealthFile("Saved current wealth data to the selected local file."));
acceptPfEstimateButton.addEventListener("click", acceptPfEstimate);
importNpsEmailButton.addEventListener("click", importNpsFromEmail);
savePfProjectionButton.addEventListener("click", savePfProjectionBaseline);
clearPfProjectionButton.addEventListener("click", clearPfProjectionBaseline);
savePpfButton.addEventListener("click", savePpfRecord);
clearPpfButton.addEventListener("click", clearPpfRecord);
validatePfProjectionButton.addEventListener("click", () => {
  window.open(EPFO_PASSBOOK_URL, "_blank", "noopener,noreferrer");
  setPfProjectionStatus("Opened EPFO. Optional but recommended: compare the estimate with the official balance. If it looks right, click Accept estimate and save.");
});

clearNpsButton.addEventListener("click", () => {
  npsInput.value = "";
  lastNpsResult = null;
  wealthData.nps = null;
  resetNpsView();
  refreshPortfolioSummary();
  saveWealthFile("Cleared NPS data and saved the local wealth file.");
});

downloadXlsButton.addEventListener("click", () => {
  if (!wealthData.pf && !wealthData.ppf && !lastNpsResult && !pfProjection) {
    setPfProjectionStatus("Create/open a wealth file and save PF, PPF, or NPS data before downloading an XLS file.");
    return;
  }

  downloadWorkbook(lastNpsResult, pfProjection);
});

initLocalWealthFile();

async function initLocalWealthFile() {
  if (!supportsFileSystemAccess()) {
    setWealthFileStatus("This browser cannot persist a chosen file location. Use latest Chrome or Edge for local wealth-file storage.");
    return;
  }

  try {
    const handle = await getStoredWealthFileHandle();
    if (!handle) {
      setWealthFileStatus("Choose or create a local wealth file. The app will read that file on future opens when browser permission is available.");
      hydrateFromWealthData();
      return;
    }

    wealthFileHandle = handle;
    const hasPermission = await verifyPermission(wealthFileHandle, "readwrite");
    if (!hasPermission) {
      setWealthFileStatus("A previous wealth file was found. Click Open existing wealth file and allow access to read it again.");
      hydrateFromWealthData();
      return;
    }

    await readWealthFile();
  } catch (error) {
    setWealthFileStatus(`Could not restore local wealth file: ${error.message}`);
    hydrateFromWealthData();
  }
}

async function createWealthFile() {
  if (!supportsFileSystemAccess()) {
    setWealthFileStatus("Local file selection is supported in Chrome/Edge. Please use one of those browsers.");
    return;
  }

  try {
    wealthFileHandle = await window.showSaveFilePicker({
      suggestedName: "wealth-dashboard-data.json",
      types: [
        {
          description: "Wealth dashboard data",
          accept: {
            "application/json": [".json"]
          }
        }
      ]
    });
    await storeWealthFileHandle(wealthFileHandle);
    wealthData = createEmptyWealthData();
    pendingPfEstimate = null;
    await writeWealthFile();
    hydrateFromWealthData();
    setWealthFileStatus("Created local wealth file. Future app opens will try to read this file automatically.");
  } catch (error) {
    if (error.name !== "AbortError") {
      setWealthFileStatus(`Could not create local wealth file: ${error.message}`);
    }
  }
}

async function openWealthFile() {
  if (!supportsFileSystemAccess()) {
    setWealthFileStatus("Local file selection is supported in Chrome/Edge. Please use one of those browsers.");
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Wealth dashboard data",
          accept: {
            "application/json": [".json"]
          }
        }
      ]
    });
    wealthFileHandle = handle;
    await storeWealthFileHandle(wealthFileHandle);
    await readWealthFile();
  } catch (error) {
    if (error.name !== "AbortError") {
      setWealthFileStatus(`Could not open local wealth file: ${error.message}`);
    }
  }
}

async function readWealthFile() {
  const file = await wealthFileHandle.getFile();
  const text = await file.text();
  const parsed = text.trim() ? JSON.parse(text) : createEmptyWealthData();
  const result = applyPfMonthlyEstimate(normalizeWealthData(parsed), new Date());

  wealthData = result.data;
  pendingPfEstimate = result.estimate?.applied ? result.estimate : null;
  hydrateFromWealthData(result.estimate);

  if (pendingPfEstimate) {
    setWealthFileStatus(`Read ${wealthFileHandle.name}. Estimated PF increased by ${formatCurrency(pendingPfEstimate.monthsElapsed * pendingPfEstimate.monthlyDeposit)} for ${pendingPfEstimate.monthsElapsed} completed month(s). Validate if desired, then click Accept estimate and save.`);
  } else {
    setWealthFileStatus(`Read ${wealthFileHandle.name}. No monthly PF estimate was added because less than one full month elapsed or no PF baseline exists.`);
  }
}

async function saveWealthFile(successMessage) {
  if (!wealthFileHandle) {
    setWealthFileStatus("Select or create a local wealth file before saving.");
    return false;
  }

  try {
    await writeWealthFile();
    setWealthFileStatus(successMessage);
    return true;
  } catch (error) {
    setWealthFileStatus(`Could not save local wealth file: ${error.message}`);
    return false;
  }
}

async function writeWealthFile() {
  wealthData.lastUpdatedAt = new Date().toISOString();
  const writable = await wealthFileHandle.createWritable();
  await writable.write(JSON.stringify(wealthData, null, 2));
  await writable.close();
}

function acceptPfEstimate() {
  if (!pendingPfEstimate) {
    setWealthFileStatus("No pending PF estimate to accept. The stored PF value is already current for the selected file.");
    return;
  }

  wealthData.pf = {
    ...wealthData.pf,
    lastAcceptedEstimateAt: new Date().toISOString()
  };
  pendingPfEstimate = null;
  saveWealthFile("Accepted the estimated PF value and saved it to the local wealth file.");
}

function hydrateFromWealthData(estimate = null) {
  pfProjection = createPfProjectionView(wealthData.pf, estimate, new Date());

  if (wealthData.pf) {
    pfBaselineBalance.value = wealthData.pf.currentBalance;
    pfBaselineEmployee.value = wealthData.pf.employeeContribution;
    pfBaselineEmployer.value = wealthData.pf.employerContribution;
  }

  if (wealthData.nps) {
    lastNpsResult = createNpsResultFromRecord(wealthData.nps);
    renderNpsResult(lastNpsResult, `Loaded NPS value ${lastNpsResult.formattedTotalValue} from local wealth file.`);
  } else {
    lastNpsResult = null;
    resetNpsView();
  }

  if (wealthData.ppf) {
    ppfBalance.value = wealthData.ppf.currentBalance;
    ppfYearlyContribution.value = wealthData.ppf.yearlyContribution ?? "";
    ppfAccountLabel.value = wealthData.ppf.accountLabel || "";
    ppfNotes.value = wealthData.ppf.notes || "";
  } else {
    ppfBalance.value = "";
    ppfYearlyContribution.value = "";
    ppfAccountLabel.value = "";
    ppfNotes.value = "";
  }

  renderPfProjection();
  renderPpf();
  refreshPortfolioSummary();
}

function savePfProjectionBaseline() {
  try {
    wealthData.pf = buildPfRecord({
      currentBalance: pfBaselineBalance.value,
      employeeContribution: pfBaselineEmployee.value,
      employerContribution: pfBaselineEmployer.value
    });
    pendingPfEstimate = null;
    pfProjection = createPfProjectionView(wealthData.pf, null, new Date());
    renderPfProjection();
    refreshPortfolioSummary();
    saveWealthFile("Saved PF baseline to the local wealth file. Future opens will estimate only after a full month has elapsed.");
  } catch (error) {
    setPfProjectionStatus(error.message);
  }
}

function clearPfProjectionBaseline() {
  wealthData.pf = null;
  pendingPfEstimate = null;
  pfProjection = null;
  pfBaselineBalance.value = "";
  pfBaselineEmployee.value = "";
  pfBaselineEmployer.value = "";
  renderPfProjection();
  refreshPortfolioSummary();
  saveWealthFile("Cleared PF baseline and saved the local wealth file.");
}

function savePpfRecord() {
  try {
    wealthData.ppf = buildPpfRecord({
      currentBalance: ppfBalance.value,
      yearlyContribution: ppfYearlyContribution.value,
      accountLabel: ppfAccountLabel.value,
      notes: ppfNotes.value
    });
    renderPpf();
    refreshPortfolioSummary();
    saveWealthFile("Saved PPF details to the local wealth file.");
  } catch (error) {
    setPpfStatus(error.message);
  }
}

function clearPpfRecord() {
  wealthData.ppf = null;
  ppfBalance.value = "";
  ppfYearlyContribution.value = "";
  ppfAccountLabel.value = "";
  ppfNotes.value = "";
  renderPpf();
  refreshPortfolioSummary();
  saveWealthFile("Cleared PPF details and saved the local wealth file.");
}

function renderPfProjection() {
  if (!pfProjection) {
    pfProjectedBalance.textContent = "-";
    pfProjectionMonthlyDeposit.textContent = "-";
    pfProjectionMonths.textContent = "-";
    setPfProjectionStatus("No PF baseline loaded. Create/open a wealth file and save PF details.");
    return;
  }

  pfProjectedBalance.textContent = formatCurrency(pfProjection.projectedBalance);
  pfProjectionMonthlyDeposit.textContent = formatCurrency(pfProjection.monthlyDeposit);
  pfProjectionMonths.textContent = String(pfProjection.monthsElapsed);

  if (pendingPfEstimate) {
    setPfProjectionStatus(`Estimated PF from saved file: ${formatCurrency(pendingPfEstimate.previousBalance)} -> ${formatCurrency(pendingPfEstimate.projectedBalance)} after ${pendingPfEstimate.monthsElapsed} completed month(s). Optional validation in EPFO is recommended before accepting.`);
    return;
  }

  setPfProjectionStatus(`Loaded PF value ${formatCurrency(pfProjection.projectedBalance)}. No estimate is pending.`);
}

function renderPpf() {
  if (!wealthData.ppf) {
    ppfTotalValue.textContent = "-";
    ppfUpdatedAt.textContent = "-";
    setPpfStatus("No PPF data saved yet.");
    return;
  }

  ppfTotalValue.textContent = formatCurrency(wealthData.ppf.currentBalance);
  ppfUpdatedAt.textContent = formatDate(wealthData.ppf.lastUpdatedAt);
  setPpfStatus(`Loaded PPF value ${formatCurrency(wealthData.ppf.currentBalance)} from local wealth file.`);
}

async function importNpsFromEmail() {
  importNpsEmailButton.disabled = true;
  setNpsEmailStatus("Connecting to mailbox and looking for NPS statement attachments...");

  try {
    const response = await fetch("/api/nps-email-import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        host: npsEmailHost.value.trim(),
        port: Number(npsEmailPort.value || 993),
        secure: true,
        username: npsEmailUsername.value.trim(),
        password: npsEmailPassword.value,
        mailbox: npsEmailMailbox.value.trim() || "INBOX",
        subjectKeywords: npsEmailSubject.value.trim() || "nps,statement",
        sinceDays: Number(npsEmailSinceDays.value || 365),
        scanLimit: Number(npsEmailScanLimit.value || 150),
        attachmentPassword: npsAttachmentPassword.value
      })
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "NPS email import failed.");
    }

    if (!payload.statementText) {
      const attachmentErrors = payload.attachments
        .filter((attachment) => attachment.error)
        .map((attachment) => `${attachment.filename}: ${attachment.error}`)
        .join("; ");
      throw new Error(attachmentErrors || "No readable NPS statement attachment was found.");
    }

    npsInput.value = payload.statementText;
    parseNpsAndRender();
    setNpsEmailStatus(`Imported ${payload.attachmentCount} attachment(s) from ${payload.messageCount} email(s). Parsed ${payload.textLength.toLocaleString("en-IN")} characters.`);
  } catch (error) {
    setNpsEmailStatus(`NPS email import failed: ${error.message}`);
  } finally {
    importNpsEmailButton.disabled = false;
  }
}

function parseNpsAndRender() {
  const result = parseNpsInput(npsInput.value);

  if (result.totalValue === null) {
    lastNpsResult = null;
    wealthData.nps = null;
    resetNpsView();
    refreshPortfolioSummary();
    setNpsStatus(result.warnings[0] || "Could not detect an NPS value. Paste the full NPS holding/statement text and try again.");
    return;
  }

  wealthData.nps = buildNpsRecord(result);
  renderNpsResult(result, `Detected NPS value ${result.formattedTotalValue}. Saving to local wealth file.`);
  saveWealthFile("Saved NPS data to the local wealth file.");
}

function renderNpsResult(result, statusText) {
  lastNpsResult = result;
  npsTotalValue.textContent = result.formattedTotalValue;
  npsContributionTotal.textContent = formatOptionalCurrency(result.contributionTotal);
  npsConfidence.textContent = `${Math.round(result.confidence * 100)}%`;
  npsSource.textContent = formatNpsSource(result.valueSource);
  renderNpsWarnings(result.warnings || []);
  renderNpsHoldings(result.holdings || []);

  refreshPortfolioSummary();
  setNpsStatus(statusText);
}

function createNpsResultFromRecord(record) {
  return {
    totalValue: record.totalValue,
    formattedTotalValue: formatCurrency(record.totalValue),
    valueSource: record.valueSource,
    confidence: record.confidence || 0,
    contributionTotal: record.contributionTotal,
    pran: record.pran,
    holdings: record.holdings || [],
    warnings: [],
    lineCount: 0
  };
}

function resetNpsView() {
  npsTotalValue.textContent = "-";
  npsContributionTotal.textContent = "-";
  npsConfidence.textContent = "-";
  npsSource.textContent = "-";
  npsWarningList.innerHTML = "";
  npsHoldingList.innerHTML = `<tr><td colspan="6">No NPS holdings detected.</td></tr>`;
}

function refreshPortfolioSummary() {
  const pfValue = pfProjection?.projectedBalance ?? null;
  const npsValue = lastNpsResult?.totalValue ?? null;
  const ppfValue = wealthData.ppf?.currentBalance ?? null;
  const total = sumNullable([pfValue, ppfValue, npsValue]);

  portfolioTotal.textContent = total === null ? "-" : formatCurrency(total);
  dashboard.hidden = !pfProjection && !lastNpsResult && !wealthData.ppf;
  downloadXlsButton.disabled = !pfProjection && !lastNpsResult && !wealthData.ppf;
  saveWealthFileButton.disabled = !wealthFileHandle;
  acceptPfEstimateButton.disabled = !pendingPfEstimate;
}

function renderNpsWarnings(warnings) {
  npsWarningList.innerHTML = "";

  if (warnings.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No NPS parser warnings.";
    npsWarningList.append(item);
    return;
  }

  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    npsWarningList.append(item);
  }
}

function renderNpsHoldings(holdings) {
  npsHoldingList.innerHTML = "";

  if (holdings.length === 0) {
    npsHoldingList.innerHTML = `<tr><td colspan="6">No NPS holdings detected.</td></tr>`;
    return;
  }

  for (const holding of holdings) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(holding.tier || "-")}</td>
      <td>${escapeHtml(holding.scheme)}</td>
      <td>${numberForDisplay(holding.units)}</td>
      <td>${formatOptionalCurrency(holding.nav)}</td>
      <td>${formatOptionalCurrency(holding.value)}</td>
      <td>${escapeHtml(holding.raw)}</td>
    `;
    npsHoldingList.append(row);
  }
}

function downloadWorkbook(npsResult, pfProjectionResult) {
  const workbook = buildWorkbookXml(npsResult, pfProjectionResult);
  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8"
  });
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);

  link.href = URL.createObjectURL(blob);
  link.download = `wealth-dashboard-${timestamp}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  setPfProjectionStatus("Downloaded an Excel-compatible XLS workbook with Summary, PF, and NPS sheets.");
}

function buildWorkbookXml(npsResult, pfProjectionResult) {
  const pfValue = pfProjectionResult?.projectedBalance ?? null;
  const ppfValue = wealthData.ppf?.currentBalance ?? null;
  const npsValue = npsResult?.totalValue ?? null;
  const combinedValue = sumNullable([pfValue, ppfValue, npsValue]);
  const worksheets = [
    worksheetXml("Summary", [
      ["Asset", "Total Value", "Last Updated"],
      ["PF / EPFO", pfValue, wealthData.pf?.lastUpdatedAt || ""],
      ["PPF", ppfValue, wealthData.ppf?.lastUpdatedAt || ""],
      ["NPS", npsValue, wealthData.nps?.lastUpdatedAt || ""],
      ["Combined Total", combinedValue, new Date().toISOString()]
    ]),
    worksheetXml("PF Projection", [
      ["Metric", "Value"],
      ["Current PF balance", wealthData.pf?.currentBalance ?? null],
      ["Last month employee contribution", wealthData.pf?.employeeContribution ?? null],
      ["Last month employer contribution", wealthData.pf?.employerContribution ?? null],
      ["Assumed monthly deposit", pfProjectionResult?.monthlyDeposit ?? null],
      ["Last calculated at", wealthData.pf?.lastCalculatedAt ?? ""],
      ["Projected PF balance", pfProjectionResult?.projectedBalance ?? null],
      ["Pending estimate accepted", pendingPfEstimate ? "No" : "Yes"],
      ["Validation recommendation", pfProjectionResult ? "Optional but recommended: manually log into EPFO and compare with official current balance" : ""]
    ]),
    worksheetXml("PPF", [
      ["Metric", "Value"],
      ["Current PPF balance", wealthData.ppf?.currentBalance ?? null],
      ["Yearly contribution", wealthData.ppf?.yearlyContribution ?? null],
      ["Account label", wealthData.ppf?.accountLabel ?? ""],
      ["Notes", wealthData.ppf?.notes ?? ""],
      ["Last updated at", wealthData.ppf?.lastUpdatedAt ?? ""]
    ]),
    worksheetXml("NPS Summary", [
      ["Metric", "Value"],
      ["Total NPS value", npsResult?.totalValue ?? null],
      ["Total contribution", npsResult?.contributionTotal ?? null],
      ["PRAN", npsResult?.pran ?? ""],
      ["Detection source", npsResult?.valueSource ?? ""],
      ["Parser confidence", npsResult ? `${Math.round(npsResult.confidence * 100)}%` : ""]
    ]),
    worksheetXml("NPS Holdings", [
      ["Tier", "Scheme", "Units", "NAV", "Current Value", "Raw"],
      ...((npsResult?.holdings || []).map((holding) => [
        holding.tier || "",
        holding.scheme,
        holding.units,
        holding.nav,
        holding.value,
        holding.raw
      ]))
    ])
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#E8F1FF" ss:Pattern="Solid"/></Style>
 </Styles>
 ${worksheets.join("\n")}
</Workbook>`;
}

function supportsFileSystemAccess() {
  return "showOpenFilePicker" in window && "showSaveFilePicker" in window;
}

function sumNullable(values) {
  const presentValues = values.filter((value) => value !== null && value !== undefined);
  if (presentValues.length === 0) {
    return null;
  }

  return presentValues.reduce((total, value) => total + value, 0);
}

function formatOptionalCurrency(value) {
  return value === null || value === undefined ? "-" : formatCurrency(value);
}

function numberForDisplay(value) {
  return value === null || value === undefined ? "-" : String(value);
}

function formatNpsSource(value) {
  return {
    "labelled-total": "Clear NPS total label",
    "investment-summary": "NPS investment summary",
    "holding-sum": "Sum of detected NPS holdings",
    "not-found": "Not found"
  }[value] || value;
}

function worksheetXml(name, rows) {
  return `<Worksheet ss:Name="${xmlEscape(name)}">
  <Table>
   ${rows.map((row, index) => rowXml(row, index === 0)).join("\n")}
  </Table>
 </Worksheet>`;
}

function rowXml(row, isHeader = false) {
  return `<Row>${row.map((cell) => cellXml(cell, isHeader)).join("")}</Row>`;
}

function cellXml(value, isHeader) {
  const isNumber = typeof value === "number" && Number.isFinite(value);
  const style = isHeader ? " ss:StyleID=\"header\"" : "";
  const type = isNumber ? "Number" : "String";
  const content = isNumber ? String(value) : xmlEscape(value ?? "");

  return `<Cell${style}><Data ss:Type="${type}">${content}</Data></Cell>`;
}

function setWealthFileStatus(message) {
  wealthFileStatus.textContent = message;
}

function setPfProjectionStatus(message) {
  pfProjectionStatus.textContent = message;
}

function setPpfStatus(message) {
  ppfStatus.textContent = message;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function setNpsEmailStatus(message) {
  npsEmailStatusMessage.textContent = message;
}

function setNpsStatus(message) {
  npsStatusMessage.textContent = message;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
