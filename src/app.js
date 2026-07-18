import { formatCurrency, parsePassbookInput } from "./epfoParser.js";
import { parseNpsInput } from "./npsParser.js";
import {
  PF_PROJECTION_STORAGE_KEY,
  calculatePfProjection,
  createPfProjectionBaseline
} from "./pfProjection.js";

const EPFO_PASSBOOK_URL = "https://passbook.epfindia.gov.in/MemberPassBook/Login";
const NPS_PORTAL_URL = "https://cra-nsdl.com/CRA/";

const openPortalButton = document.querySelector("#open-portal");
const openNpsPortalButton = document.querySelector("#open-nps-portal");
const fileInput = document.querySelector("#passbook-file");
const npsFileInput = document.querySelector("#nps-file");
const passbookInput = document.querySelector("#passbook-input");
const npsInput = document.querySelector("#nps-input");
const parseButton = document.querySelector("#parse-passbook");
const parseNpsButton = document.querySelector("#parse-nps");
const importNpsEmailButton = document.querySelector("#import-nps-email");
const llmButton = document.querySelector("#llm-extract");
const llmModelInput = document.querySelector("#llm-model");
const clearButton = document.querySelector("#clear-data");
const clearNpsButton = document.querySelector("#clear-nps");
const sampleButton = document.querySelector("#load-sample");
const sampleNpsButton = document.querySelector("#load-nps-sample");
const downloadXlsButton = document.querySelector("#download-xls");
const statusMessage = document.querySelector("#status-message");
const npsStatusMessage = document.querySelector("#nps-status-message");
const npsEmailStatusMessage = document.querySelector("#nps-email-status-message");
const localImportStatus = document.querySelector("#local-import-status");
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
const dashboard = document.querySelector("#dashboard");
const portfolioTotal = document.querySelector("#portfolio-total");
const totalBalance = document.querySelector("#total-balance");
const pfProjectedBalance = document.querySelector("#pf-projected-balance");
const pfProjectionMonthlyDeposit = document.querySelector("#pf-projection-monthly-deposit");
const pfProjectionMonths = document.querySelector("#pf-projection-months");
const npsTotalValue = document.querySelector("#nps-total-value");
const employeeTotal = document.querySelector("#employee-total");
const employerTotal = document.querySelector("#employer-total");
const pensionTotal = document.querySelector("#pension-total");
const npsContributionTotal = document.querySelector("#nps-contribution-total");
const confidence = document.querySelector("#confidence");
const source = document.querySelector("#source");
const npsConfidence = document.querySelector("#nps-confidence");
const npsSource = document.querySelector("#nps-source");
const componentList = document.querySelector("#component-list");
const companyList = document.querySelector("#company-list");
const npsHoldingList = document.querySelector("#nps-holding-list");
const warningList = document.querySelector("#warning-list");
const npsWarningList = document.querySelector("#nps-warning-list");
const recordList = document.querySelector("#record-list");

let lastPfResult = null;
let lastNpsResult = null;
let lastRemoteImportId = null;
let pfProjectionBaseline = loadPfProjectionBaseline();
let pfProjection = calculatePfProjection(pfProjectionBaseline);

openPortalButton.addEventListener("click", () => {
  window.open(EPFO_PASSBOOK_URL, "_blank", "noopener,noreferrer");
  setStatus("Opened the official EPFO passbook portal in a new tab. Log in there, open the passbook, then use the browser extension import button or paste/download manually.");
});

openNpsPortalButton.addEventListener("click", () => {
  window.open(NPS_PORTAL_URL, "_blank", "noopener,noreferrer");
  setNpsStatus("Opened the NPS CRA portal in a new tab. Log in there, then copy or download your holdings/statement content and import it below.");
});

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const text = await file.text();
  passbookInput.value = text;
  parseAndRender();
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

parseButton.addEventListener("click", parseAndRender);
parseNpsButton.addEventListener("click", parseNpsAndRender);
importNpsEmailButton.addEventListener("click", importNpsFromEmail);
llmButton.addEventListener("click", runLocalLlmExtraction);
savePfProjectionButton.addEventListener("click", savePfProjectionBaseline);
clearPfProjectionButton.addEventListener("click", clearPfProjectionBaseline);
validatePfProjectionButton.addEventListener("click", () => {
  window.open(EPFO_PASSBOOK_URL, "_blank", "noopener,noreferrer");
  setPfProjectionStatus("Opened EPFO. Log in manually and compare the projected PF balance with the official current balance.");
});

clearButton.addEventListener("click", () => {
  passbookInput.value = "";
  fileInput.value = "";
  lastPfResult = null;
  resetPfView();
  refreshPortfolioSummary();
  setStatus("Cleared imported passbook content from this page.");
});

clearNpsButton.addEventListener("click", () => {
  npsInput.value = "";
  npsFileInput.value = "";
  lastNpsResult = null;
  resetNpsView();
  refreshPortfolioSummary();
  setNpsStatus("Cleared imported NPS content from this page.");
});

sampleButton.addEventListener("click", () => {
  passbookInput.value = `EPFO Member Passbook
Establishment ID & Name: ABC TECHNOLOGIES PRIVATE LIMITED
Member ID: PYBOM00012340000001234
Wage Month Employee Share Employer Share Pension Share Balance
Jan-2026 1,800 550 1,250 1,72,000
Feb-2026 1,850 565 1,285 1,76,850

Establishment ID & Name: XYZ SERVICES LLP
Member ID: MHBAN00056780000005678
Wage Month EPF Wages EPS Wages EDLI Wages Employee Share Employer Share Pension Share Balance
Jan-2026 15,000 15,000 15,000 1,800 550 1,250 90,000
Feb-2026 15,500 15,000 15,500 1,860 570 1,290 95,500`;
  parseAndRender();
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
    setStatus("Import PF or NPS content before downloading an XLS file.");
    return;
  }

  downloadWorkbook(lastPfResult, lastNpsResult, pfProjection);
});

restorePfProjectionUi();
refreshPortfolioSummary();

function parseAndRender() {
  const result = parsePassbookInput(passbookInput.value);

  if (result.totalBalance === null) {
    lastPfResult = null;
    resetPfView();
    refreshPortfolioSummary();
    setStatus(result.warnings[0] || "Could not detect a balance. Paste the full passbook text and try again.");
    return;
  }

  renderParsedResult(result, `Detected ${result.formattedTotalBalance} from ${result.lineCount} imported lines across ${result.companySummaries.length || 1} company group(s). Review it against EPFO before relying on it.`);
}

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
    setPfProjectionStatus("Saved PF projection baseline locally. Download local XLS to keep an Excel copy, and validate by manually logging into EPFO.");
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
  setPfProjectionStatus(`Projected from saved baseline on ${formatDate(pfProjection.savedAt)}. Validate by logging into EPFO manually.`);
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

async function runLocalLlmExtraction() {
  const pageText = passbookInput.value.trim();
  if (!pageText) {
    setStatus("Import EPFO passbook content before asking the local LLM.");
    return;
  }

  llmButton.disabled = true;
  setStatus("Asking local Ollama model to extract EPFO balance JSON...");

  try {
    const response = await fetch("/api/llm-extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pageText,
        model: llmModelInput.value.trim() || "llama3.2:1b"
      })
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Local LLM extraction failed.");
    }

    const result = buildResultFromLlmExtraction(payload.extraction, pageText);
    if (result.totalBalance === null) {
      setStatus("Local LLM did not find a total balance. Try the rule-based parser or another local model.");
      return;
    }

    renderParsedResult(result, `Local LLM (${payload.model}) extracted ${result.formattedTotalBalance}. Review it against EPFO before relying on it.`);
  } catch (error) {
    setStatus(`Local LLM failed: ${error.message}. Make sure Ollama is running locally and the model is installed.`);
  } finally {
    llmButton.disabled = false;
  }
}

function renderParsedResult(result, statusText) {
  lastPfResult = result;
  totalBalance.textContent = result.formattedTotalBalance;
  employeeTotal.textContent = formatOptionalCurrency(result.totals.employee);
  employerTotal.textContent = formatOptionalCurrency(result.totals.employer);
  pensionTotal.textContent = formatOptionalCurrency(result.totals.pension);
  confidence.textContent = `${Math.round(result.confidence * 100)}%`;
  source.textContent = formatSource(result.balanceSource);
  renderComponents(result.components);
  renderCompanies(result.companySummaries);
  renderWarnings(result.warnings);
  renderRecords(result.records);

  refreshPortfolioSummary();
  setStatus(statusText);
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
}

function resetPfView() {
  totalBalance.textContent = "-";
  employeeTotal.textContent = "-";
  employerTotal.textContent = "-";
  pensionTotal.textContent = "-";
  confidence.textContent = "-";
  source.textContent = "-";
  componentList.innerHTML = "";
  companyList.innerHTML = `<tr><td colspan="7">No company-wise rows detected.</td></tr>`;
  warningList.innerHTML = "";
  recordList.innerHTML = `<tr><td colspan="6">No monthly rows detected.</td></tr>`;
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

pollLatestImport();
setInterval(pollLatestImport, 2500);

async function pollLatestImport() {
  try {
    const response = await fetch("/api/latest-import", {
      cache: "no-store"
    });

    if (!response.ok) {
      setLocalImportStatus("Local importer is unavailable. Start the app with npm start.");
      return;
    }

    const payload = await response.json();
    const latestImport = payload.import;

    if (!latestImport) {
      setLocalImportStatus("Waiting for browser extension import from an EPFO tab.");
      return;
    }

    if (latestImport.id === lastRemoteImportId) {
      setLocalImportStatus(`Last browser import received at ${formatImportedAt(latestImport.importedAt)}.`);
      return;
    }

    lastRemoteImportId = latestImport.id;
    passbookInput.value = latestImport.pageText;
    parseAndRender();
    setLocalImportStatus(`Imported visible EPFO page from browser extension at ${formatImportedAt(latestImport.importedAt)}.`);
  } catch {
    setLocalImportStatus("Local importer is unavailable. Start the app with npm start.");
  }
}

function renderComponents(components) {
  componentList.innerHTML = "";

  for (const [label, value] of Object.entries(components)) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${formatComponentLabel(label)}</span><strong>${value === null ? "Not found" : formatCurrency(value)}</strong>`;
    componentList.append(item);
  }
}

function renderCompanies(companySummaries) {
  companyList.innerHTML = "";

  if (companySummaries.length === 0) {
    companyList.innerHTML = `<tr><td colspan="7">No company-wise rows detected.</td></tr>`;
    return;
  }

  for (const summary of companySummaries) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(summary.company)}</td>
      <td>${summary.memberIds.length === 0 ? "-" : summary.memberIds.map(maskMemberId).join(", ")}</td>
      <td>${summary.recordCount}</td>
      <td>${formatOptionalCurrency(summary.employeeTotal)}</td>
      <td>${formatOptionalCurrency(summary.employerTotal)}</td>
      <td>${formatOptionalCurrency(summary.pensionTotal)}</td>
      <td>${formatOptionalCurrency(summary.latestBalance)}</td>
    `;
    companyList.append(row);
  }
}

function renderWarnings(warnings) {
  warningList.innerHTML = "";

  if (warnings.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No parser warnings.";
    warningList.append(item);
    return;
  }

  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    warningList.append(item);
  }
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

function renderRecords(records) {
  recordList.innerHTML = "";

  if (records.length === 0) {
    recordList.innerHTML = `<tr><td colspan="6">No monthly rows detected.</td></tr>`;
    return;
  }

  for (const record of records) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(record.company)}</td>
      <td>${record.period}</td>
      <td>${formatOptionalCurrency(record.employeeShare)}</td>
      <td>${formatOptionalCurrency(record.employerShare)}</td>
      <td>${formatOptionalCurrency(record.pensionShare)}</td>
      <td>${formatOptionalCurrency(record.rowBalance)}</td>
    `;
    recordList.append(row);
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

function buildResultFromLlmExtraction(extraction, pageText) {
  const companySummaries = (extraction.companies || []).map((company) => ({
    company: company.company || "Unknown company",
    memberIds: company.memberId ? [company.memberId] : [],
    employeeTotal: company.employeeTotal,
    employerTotal: company.employerTotal,
    pensionTotal: company.pensionTotal,
    contributionTotal: sumNullable([company.employeeTotal, company.employerTotal, company.pensionTotal]),
    latestBalance: company.latestBalance,
    recordCount: 0
  }));
  const companyBalanceTotal = sumNullable(companySummaries.map((company) => company.latestBalance));
  const totalBalance = extraction.totalBalance ?? companyBalanceTotal;
  const totals = {
    employee: extraction.employeeContributionTotal,
    employer: extraction.employerContributionTotal,
    pension: extraction.pensionContributionTotal,
    contributionTotal: sumNullable([
      extraction.employeeContributionTotal,
      extraction.employerContributionTotal,
      extraction.pensionContributionTotal
    ])
  };

  return {
    totalBalance,
    formattedTotalBalance: totalBalance === null ? null : formatCurrency(totalBalance),
    balanceSource: "local-llm",
    confidence: extraction.confidence || 0,
    components: {
      employee: totals.employee,
      employer: totals.employer,
      pension: totals.pension
    },
    totals,
    companySummaries,
    records: [],
    warnings: [
      "This result was extracted by a local LLM. Treat it as an assistive fallback and verify against the EPFO page.",
      ...((extraction.evidence || []).map((item) => `Evidence: ${item}`))
    ],
    lineCount: pageText.split(/\r?\n/).filter(Boolean).length
  };
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
  setStatus("Downloaded an Excel-compatible XLS workbook with Summary, PF, and NPS sheets.");
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
      ["PF projection requires EPFO validation", pfProjectionResult ? "Yes - manually log into EPFO and compare" : ""]
    ]),
    worksheetXml("PF Summary", [
      ["Metric", "Value"],
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
      ["Validation required", pfProjectionResult ? "Manually log into EPFO and compare with official current balance" : ""]
    ]),
    worksheetXml("PF Company Wise", [
      ["Company", "Member IDs", "Rows", "Employee Contribution", "Employer Contribution", "Pension / EPS", "Total Contribution", "Latest Balance"],
      ...((pfResult?.companySummaries || []).map((summary) => [
        summary.company,
        summary.memberIds.join(", "),
        summary.recordCount,
        summary.employeeTotal,
        summary.employerTotal,
        summary.pensionTotal,
        summary.contributionTotal,
        summary.latestBalance
      ]))
    ]),
    worksheetXml("PF Rows", [
      ["Company", "Member ID", "Period", "Employee Contribution", "Employer Contribution", "Pension / EPS", "Row Balance"],
      ...((pfResult?.records || []).map((record) => [
        record.company,
        record.memberId || "",
        record.period,
        record.employeeShare,
        record.employerShare,
        record.pensionShare,
        record.rowBalance
      ]))
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

function formatComponentLabel(label) {
  return {
    employee: "Employee share",
    employer: "Employer share",
    pension: "Pension / EPS"
  }[label] || label;
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

function setStatus(message) {
  statusMessage.textContent = message;
}

function setPfProjectionStatus(message) {
  pfProjectionStatus.textContent = message;
}

function setLocalImportStatus(message) {
  if (localImportStatus) {
    localImportStatus.textContent = message;
  }
}

function setNpsEmailStatus(message) {
  npsEmailStatusMessage.textContent = message;
}

function formatImportedAt(value) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function maskMemberId(memberId) {
  if (memberId.length <= 8) {
    return memberId;
  }

  return `${memberId.slice(0, 5)}...${memberId.slice(-4)}`;
}

function numberForSheet(value) {
  return value === null || value === undefined ? "" : String(value);
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
