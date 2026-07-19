import { formatCurrency } from "./epfoParser.js";
import { parseNpsInput } from "./npsParser.js";
import {
  PF_PROJECTION_STORAGE_KEY,
  calculatePfProjection,
  createPfProjectionBaseline
} from "./pfProjection.js";
import {
  GOOGLE_SHEETS_SETTINGS_KEY,
  buildPortfolioExportPayload
} from "./portfolioExport.js";

const EPFO_PASSBOOK_URL = "https://passbook.epfindia.gov.in/MemberPassBook/Login";
const NPS_PORTAL_URL = "https://cra-nsdl.com/CRA/";

const openNpsPortalButton = document.querySelector("#open-nps-portal");
const npsFileInput = document.querySelector("#nps-file");
const npsInput = document.querySelector("#nps-input");
const parseNpsButton = document.querySelector("#parse-nps");
const importNpsEmailButton = document.querySelector("#import-nps-email");
const clearNpsButton = document.querySelector("#clear-nps");
const sampleNpsButton = document.querySelector("#load-nps-sample");
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
const npsAttachmentPassword = document.querySelector("#nps-attachment-password");
const pfBaselineBalance = document.querySelector("#pf-baseline-balance");
const pfBaselineEmployee = document.querySelector("#pf-baseline-employee");
const pfBaselineEmployer = document.querySelector("#pf-baseline-employer");
const savePfProjectionButton = document.querySelector("#save-pf-projection");
const validatePfProjectionButton = document.querySelector("#validate-pf-projection");
const clearPfProjectionButton = document.querySelector("#clear-pf-projection");
const pfProjectionStatus = document.querySelector("#pf-projection-status");
const googleScriptUrl = document.querySelector("#google-script-url");
const googleSpreadsheetId = document.querySelector("#google-spreadsheet-id");
const googleAutosave = document.querySelector("#google-autosave");
const saveGoogleSheetsButton = document.querySelector("#save-google-sheets");
const googleSheetsStatus = document.querySelector("#google-sheets-status");
const dashboard = document.querySelector("#dashboard");
const portfolioTotal = document.querySelector("#portfolio-total");
const pfProjectedBalance = document.querySelector("#pf-projected-balance");
const pfProjectionMonthlyDeposit = document.querySelector("#pf-projection-monthly-deposit");
const pfProjectionMonths = document.querySelector("#pf-projection-months");
const npsTotalValue = document.querySelector("#nps-total-value");
const npsContributionTotal = document.querySelector("#nps-contribution-total");
const npsConfidence = document.querySelector("#nps-confidence");
const npsSource = document.querySelector("#nps-source");
const npsHoldingList = document.querySelector("#nps-holding-list");
const npsWarningList = document.querySelector("#nps-warning-list");

const lastPfResult = null;
let lastNpsResult = null;
let pfProjectionBaseline = loadPfProjectionBaseline();
let pfProjection = calculatePfProjection(pfProjectionBaseline);

openNpsPortalButton.addEventListener("click", () => {
  window.open(NPS_PORTAL_URL, "_blank", "noopener,noreferrer");
  setNpsStatus("Opened the NPS CRA portal in a new tab. Log in there, then copy or download your holdings/statement content and import it below.");
});

npsFileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const text = await file.text();
  npsInput.value = text;
  parseNpsAndRender();
});

parseNpsButton.addEventListener("click", parseNpsAndRender);
importNpsEmailButton.addEventListener("click", importNpsFromEmail);
savePfProjectionButton.addEventListener("click", savePfProjectionBaseline);
clearPfProjectionButton.addEventListener("click", clearPfProjectionBaseline);
saveGoogleSheetsButton.addEventListener("click", () => saveToGoogleSheets({ openResult: true, reason: "Manual Google Sheets save" }));
validatePfProjectionButton.addEventListener("click", () => {
  window.open(EPFO_PASSBOOK_URL, "_blank", "noopener,noreferrer");
  setPfProjectionStatus("Opened EPFO. Optional but recommended: log in manually and compare the projected PF balance with the official current balance.");
});

clearNpsButton.addEventListener("click", () => {
  npsInput.value = "";
  npsFileInput.value = "";
  lastNpsResult = null;
  resetNpsView();
  refreshPortfolioSummary();
  setNpsStatus("Cleared imported NPS content from this page.");
});

sampleNpsButton.addEventListener("click", () => {
  npsInput.value = `NPS Holdings Statement
PRAN: 110012345678
Total Contribution: Rs 4,20,000
Total NPS Corpus: Rs 5,84,250

Tier I Scheme Units NAV Current Value
Tier I Equity Scheme E 1,250.0000 62.50 78,125
Tier I Corporate Bond Scheme C 3,100.0000 38.75 1,20,125
Tier I Government Securities Scheme G 7,800.0000 49.50 3,86,000`;
  parseNpsAndRender();
});

downloadXlsButton.addEventListener("click", () => {
  if (!lastPfResult && !lastNpsResult && !pfProjection) {
    setPfProjectionStatus("Save a PF projection baseline or import NPS content before downloading an XLS file.");
    return;
  }

  downloadWorkbook(lastPfResult, lastNpsResult, pfProjection);
});

restorePfProjectionUi();
restoreGoogleSheetsSettings();
refreshPortfolioSummary();

function parseNpsAndRender() {
  const result = parseNpsInput(npsInput.value);

  if (result.totalValue === null) {
    lastNpsResult = null;
    resetNpsView();
    refreshPortfolioSummary();
    setNpsStatus(result.warnings[0] || "Could not detect an NPS value. Paste the full NPS holding/statement text and try again.");
    return;
  }

  renderNpsResult(result, `Detected NPS value ${result.formattedTotalValue} from ${result.lineCount} imported lines. Review it against the NPS portal before relying on it.`);
}

function savePfProjectionBaseline() {
  try {
    pfProjectionBaseline = createPfProjectionBaseline({
      currentBalance: pfBaselineBalance.value,
      employeeContribution: pfBaselineEmployee.value,
      employerContribution: pfBaselineEmployer.value
    });
    localStorage.setItem(PF_PROJECTION_STORAGE_KEY, JSON.stringify(pfProjectionBaseline));
    pfProjection = calculatePfProjection(pfProjectionBaseline);
    renderPfProjection();
    refreshPortfolioSummary();
    setPfProjectionStatus("Saved PF projection baseline locally. Download local XLS to keep an Excel copy. Optional EPFO validation is recommended.");
    autoSaveToGoogleSheets("PF projection baseline saved");
  } catch (error) {
    setPfProjectionStatus(error.message);
  }
}

function clearPfProjectionBaseline() {
  pfProjectionBaseline = null;
  pfProjection = null;
  localStorage.removeItem(PF_PROJECTION_STORAGE_KEY);
  pfBaselineBalance.value = "";
  pfBaselineEmployee.value = "";
  pfBaselineEmployer.value = "";
  renderPfProjection();
  refreshPortfolioSummary();
  setPfProjectionStatus("Cleared saved PF projection baseline.");
}

function loadPfProjectionBaseline() {
  try {
    const raw = localStorage.getItem(PF_PROJECTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function restorePfProjectionUi() {
  if (!pfProjectionBaseline) {
    renderPfProjection();
    return;
  }

  pfBaselineBalance.value = pfProjectionBaseline.currentBalance;
  pfBaselineEmployee.value = pfProjectionBaseline.employeeContribution;
  pfBaselineEmployer.value = pfProjectionBaseline.employerContribution;
  pfProjection = calculatePfProjection(pfProjectionBaseline);
  renderPfProjection();
}

function renderPfProjection() {
  if (!pfProjection) {
    pfProjectedBalance.textContent = "-";
    pfProjectionMonthlyDeposit.textContent = "-";
    pfProjectionMonths.textContent = "-";
    setPfProjectionStatus("No saved PF projection baseline yet.");
    return;
  }

  pfProjectedBalance.textContent = formatCurrency(pfProjection.projectedBalance);
  pfProjectionMonthlyDeposit.textContent = formatCurrency(pfProjection.monthlyDeposit);
  pfProjectionMonths.textContent = String(pfProjection.monthsElapsed);
  setPfProjectionStatus(`Projected from saved baseline on ${formatDate(pfProjection.savedAt)}. Optional validation by logging into EPFO is recommended.`);
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

function renderNpsResult(result, statusText) {
  lastNpsResult = result;
  npsTotalValue.textContent = result.formattedTotalValue;
  npsContributionTotal.textContent = formatOptionalCurrency(result.contributionTotal);
  npsConfidence.textContent = `${Math.round(result.confidence * 100)}%`;
  npsSource.textContent = formatNpsSource(result.valueSource);
  renderNpsWarnings(result.warnings);
  renderNpsHoldings(result.holdings);

  refreshPortfolioSummary();
  setNpsStatus(statusText);
  autoSaveToGoogleSheets("NPS data updated");
}

function restoreGoogleSheetsSettings() {
  try {
    const raw = localStorage.getItem(GOOGLE_SHEETS_SETTINGS_KEY);
    if (!raw) {
      return;
    }

    const settings = JSON.parse(raw);
    googleScriptUrl.value = settings.scriptUrl || "";
    googleSpreadsheetId.value = settings.spreadsheetId || "";
    googleAutosave.checked = settings.autosave !== false;
  } catch {
    // Ignore invalid local settings.
  }
}

function saveGoogleSheetsSettings() {
  localStorage.setItem(GOOGLE_SHEETS_SETTINGS_KEY, JSON.stringify({
    scriptUrl: googleScriptUrl.value.trim(),
    spreadsheetId: googleSpreadsheetId.value.trim(),
    autosave: googleAutosave.checked
  }));
}

function autoSaveToGoogleSheets(reason) {
  saveGoogleSheetsSettings();

  if (!googleAutosave.checked || !googleScriptUrl.value.trim()) {
    return;
  }

  if (!googleSpreadsheetId.value.trim()) {
    setGoogleSheetsStatus("Google Sheets auto-save needs a Spreadsheet ID. Click Save current data to Google Sheets once to create a sheet, then copy its ID here.");
    return;
  }

  saveToGoogleSheets({ openResult: false, reason });
}

function saveToGoogleSheets({ openResult, reason }) {
  saveGoogleSheetsSettings();

  const scriptUrl = googleScriptUrl.value.trim();
  if (!scriptUrl) {
    setGoogleSheetsStatus("Paste your Google Apps Script Web App URL before saving to Google Sheets.");
    return;
  }

  if (!pfProjection && !lastNpsResult) {
    setGoogleSheetsStatus("Save PF projection data or import NPS data before saving to Google Sheets.");
    return;
  }

  const payload = buildPortfolioExportPayload({
    spreadsheetId: googleSpreadsheetId.value.trim(),
    pfProjection,
    npsResult: lastNpsResult,
    updatedAt: new Date().toISOString()
  });

  postToGoogleAppsScript(scriptUrl, payload, openResult);
  setGoogleSheetsStatus(openResult
    ? "Submitted data to Google Sheets. A new tab will show the spreadsheet link or update result."
    : `Auto-saved to Google Sheets: ${reason}.`);
}

function postToGoogleAppsScript(scriptUrl, payload, openResult) {
  const targetName = openResult ? "_blank" : "google-sheets-save-frame";
  let frame = document.querySelector(`iframe[name="${targetName}"]`);

  if (!openResult && !frame) {
    frame = document.createElement("iframe");
    frame.name = targetName;
    frame.hidden = true;
    document.body.append(frame);
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = scriptUrl;
  form.target = targetName;
  form.style.display = "none";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "payload";
  input.value = JSON.stringify(payload);
  form.append(input);

  document.body.append(form);
  form.submit();
  form.remove();
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
  const pfValue = lastPfResult?.totalBalance ?? pfProjection?.projectedBalance ?? null;
  const npsValue = lastNpsResult?.totalValue ?? null;
  const total = sumNullable([pfValue, npsValue]);

  portfolioTotal.textContent = total === null ? "-" : formatCurrency(total);
  dashboard.hidden = !lastPfResult && !lastNpsResult && !pfProjection;
  downloadXlsButton.disabled = !lastPfResult && !lastNpsResult && !pfProjection;
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

function sumNullable(values) {
  const presentValues = values.filter((value) => value !== null && value !== undefined);
  if (presentValues.length === 0) {
    return null;
  }

  return presentValues.reduce((total, value) => total + value, 0);
}

function downloadWorkbook(pfResult, npsResult, pfProjectionResult) {
  const workbook = buildWorkbookXml(pfResult, npsResult, pfProjectionResult);
  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8"
  });
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);

  link.href = URL.createObjectURL(blob);
  link.download = `epfo-balance-${timestamp}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  setPfProjectionStatus("Downloaded an Excel-compatible XLS workbook with Summary, PF, and NPS sheets.");
}

function buildWorkbookXml(pfResult, npsResult, pfProjectionResult) {
  const actualPfValue = pfResult?.totalBalance ?? null;
  const projectedPfValue = pfProjectionResult?.projectedBalance ?? null;
  const pfValue = actualPfValue ?? projectedPfValue;
  const npsValue = npsResult?.totalValue ?? null;
  const combinedValue = sumNullable([pfValue, npsValue]);
  const worksheets = [
    worksheetXml("Summary", [
      ["Asset", "Total Value", "Source"],
      ["PF / EPFO", pfValue, actualPfValue !== null ? "Official/imported PF value" : projectedPfValue !== null ? "Projected PF value" : ""],
      ["NPS", npsValue],
      ["Combined Total", combinedValue],
      ["PF actual/imported value", actualPfValue],
      ["PF projected value", projectedPfValue],
      ["PF projection validation", pfProjectionResult ? "Optional but recommended - manually log into EPFO and compare" : ""]
    ]),
    worksheetXml("PF Summary", [
      ["Metric", "Value"],
      ["PF value used in Summary", pfResult?.totalBalance ?? pfProjectionResult?.projectedBalance ?? null],
      ["PF value source", pfResult ? "Official/imported PF value" : pfProjectionResult ? "Projected PF value" : ""],
      ["Total EPFO balance", pfResult?.totalBalance ?? null],
      ["Employee contribution", pfResult?.totals.employee ?? null],
      ["Employer contribution", pfResult?.totals.employer ?? null],
      ["Pension / EPS", pfResult?.totals.pension ?? null],
      ["Detection source", pfResult ? formatSource(pfResult.balanceSource) : ""],
      ["Parser confidence", pfResult ? `${Math.round(pfResult.confidence * 100)}%` : ""]
    ]),
    worksheetXml("PF Projection", [
      ["Metric", "Value"],
      ["Saved baseline current balance", pfProjectionResult?.currentBalance ?? null],
      ["Last month employee contribution", pfProjectionResult?.employeeContribution ?? null],
      ["Last month employer contribution", pfProjectionResult?.employerContribution ?? null],
      ["Assumed monthly deposit", pfProjectionResult?.monthlyDeposit ?? null],
      ["Saved at", pfProjectionResult ? formatDate(pfProjectionResult.savedAt) : ""],
      ["Projection as of", pfProjectionResult ? formatDate(pfProjectionResult.asOf) : ""],
      ["Completed months elapsed", pfProjectionResult?.monthsElapsed ?? null],
      ["Projected PF balance", pfProjectionResult?.projectedBalance ?? null],
      ["Validation recommendation", pfProjectionResult ? "Optional but recommended: manually log into EPFO and compare with official current balance" : ""]
    ]),
    worksheetXml("NPS Summary", [
      ["Metric", "Value"],
      ["Total NPS value", npsResult?.totalValue ?? null],
      ["Total contribution", npsResult?.contributionTotal ?? null],
      ["PRAN", npsResult?.pran ?? ""],
      ["Detection source", npsResult ? formatNpsSource(npsResult.valueSource) : ""],
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
  <Style ss:ID="money"><NumberFormat ss:Format="₹#,##0.00"/></Style>
 </Styles>
 ${worksheets.join("\n")}
</Workbook>`;
}

function formatOptionalCurrency(value) {
  return value === null || value === undefined ? "-" : formatCurrency(value);
}

function numberForDisplay(value) {
  return value === null || value === undefined ? "-" : String(value);
}

function formatSource(value) {
  return {
    "labelled-total": "Clear total balance label",
    "overview-current-balance": "EPFO overview current balance",
    "closing-balance-shares": "Closing employee + employer shares",
    "component-sum": "Sum of detected components",
    "company-balance-sum": "Sum of latest company balances",
    "local-llm": "Local LLM extraction",
    "last-row-balance": "Last passbook row balance"
  }[value] || value;
}

function formatNpsSource(value) {
  return {
    "labelled-total": "Clear NPS total label",
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

function setPfProjectionStatus(message) {
  pfProjectionStatus.textContent = message;
}

function setGoogleSheetsStatus(message) {
  googleSheetsStatus.textContent = message;
}

function setNpsEmailStatus(message) {
  npsEmailStatusMessage.textContent = message;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
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
