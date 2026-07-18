import { formatCurrency, parsePassbookInput } from "./epfoParser.js";

const EPFO_PASSBOOK_URL = "https://passbook.epfindia.gov.in/MemberPassBook/Login";

const openPortalButton = document.querySelector("#open-portal");
const fileInput = document.querySelector("#passbook-file");
const passbookInput = document.querySelector("#passbook-input");
const parseButton = document.querySelector("#parse-passbook");
const clearButton = document.querySelector("#clear-data");
const sampleButton = document.querySelector("#load-sample");
const downloadXlsButton = document.querySelector("#download-xls");
const statusMessage = document.querySelector("#status-message");
const localImportStatus = document.querySelector("#local-import-status");
const dashboard = document.querySelector("#dashboard");
const totalBalance = document.querySelector("#total-balance");
const employeeTotal = document.querySelector("#employee-total");
const employerTotal = document.querySelector("#employer-total");
const pensionTotal = document.querySelector("#pension-total");
const confidence = document.querySelector("#confidence");
const source = document.querySelector("#source");
const componentList = document.querySelector("#component-list");
const companyList = document.querySelector("#company-list");
const warningList = document.querySelector("#warning-list");
const recordList = document.querySelector("#record-list");

let lastParseResult = null;
let lastRemoteImportId = null;

openPortalButton.addEventListener("click", () => {
  window.open(EPFO_PASSBOOK_URL, "_blank", "noopener,noreferrer");
  setStatus("Opened the official EPFO passbook portal in a new tab. Log in there, open the passbook, then use the browser extension import button or paste/download manually.");
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

parseButton.addEventListener("click", parseAndRender);

clearButton.addEventListener("click", () => {
  passbookInput.value = "";
  fileInput.value = "";
  lastParseResult = null;
  dashboard.hidden = true;
  downloadXlsButton.disabled = true;
  setStatus("Cleared imported passbook content from this page.");
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

downloadXlsButton.addEventListener("click", () => {
  if (!lastParseResult) {
    setStatus("Import passbook content before downloading an XLS file.");
    return;
  }

  downloadWorkbook(lastParseResult);
});

function parseAndRender() {
  const result = parsePassbookInput(passbookInput.value);

  if (!result.totalBalance) {
    lastParseResult = null;
    dashboard.hidden = true;
    downloadXlsButton.disabled = true;
    setStatus(result.warnings[0] || "Could not detect a balance. Paste the full passbook text and try again.");
    return;
  }

  lastParseResult = result;
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

  dashboard.hidden = false;
  downloadXlsButton.disabled = false;
  setStatus(`Detected ${result.formattedTotalBalance} from ${result.lineCount} imported lines across ${result.companySummaries.length || 1} company group(s). Review it against EPFO before relying on it.`);
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

function downloadWorkbook(result) {
  const workbook = buildWorkbookHtml(result);
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
  setStatus("Downloaded an Excel-compatible XLS file to your browser downloads folder.");
}

function buildWorkbookHtml(result) {
  const companyRows = result.companySummaries.map((summary) => `
    <tr>
      <td>${escapeHtml(summary.company)}</td>
      <td>${escapeHtml(summary.memberIds.join(", "))}</td>
      <td>${summary.recordCount}</td>
      <td>${numberForSheet(summary.employeeTotal)}</td>
      <td>${numberForSheet(summary.employerTotal)}</td>
      <td>${numberForSheet(summary.pensionTotal)}</td>
      <td>${numberForSheet(summary.contributionTotal)}</td>
      <td>${numberForSheet(summary.latestBalance)}</td>
    </tr>
  `).join("");

  const recordRows = result.records.map((record) => `
    <tr>
      <td>${escapeHtml(record.company)}</td>
      <td>${escapeHtml(record.memberId || "")}</td>
      <td>${escapeHtml(record.period)}</td>
      <td>${numberForSheet(record.employeeShare)}</td>
      <td>${numberForSheet(record.employerShare)}</td>
      <td>${numberForSheet(record.pensionShare)}</td>
      <td>${numberForSheet(record.rowBalance)}</td>
    </tr>
  `).join("");

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; margin-bottom: 24px; }
          th, td { border: 1px solid #999; padding: 6px 10px; }
          th { background: #e8f1ff; }
        </style>
      </head>
      <body>
        <h1>EPFO Balance Summary</h1>
        <table>
          <tr><th>Total EPFO balance</th><td>${numberForSheet(result.totalBalance)}</td></tr>
          <tr><th>Total employee contribution</th><td>${numberForSheet(result.totals.employee)}</td></tr>
          <tr><th>Total employer contribution</th><td>${numberForSheet(result.totals.employer)}</td></tr>
          <tr><th>Total pension / EPS</th><td>${numberForSheet(result.totals.pension)}</td></tr>
          <tr><th>Detection source</th><td>${escapeHtml(formatSource(result.balanceSource))}</td></tr>
          <tr><th>Parser confidence</th><td>${Math.round(result.confidence * 100)}%</td></tr>
        </table>

        <h2>Company-wise totals</h2>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Member IDs</th>
              <th>Rows</th>
              <th>Employee contribution</th>
              <th>Employer contribution</th>
              <th>Pension / EPS</th>
              <th>Total contribution</th>
              <th>Latest balance</th>
            </tr>
          </thead>
          <tbody>${companyRows || `<tr><td colspan="8">No company-wise rows detected.</td></tr>`}</tbody>
        </table>

        <h2>Detected rows</h2>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Member ID</th>
              <th>Period</th>
              <th>Employee contribution</th>
              <th>Employer contribution</th>
              <th>Pension / EPS</th>
              <th>Row balance</th>
            </tr>
          </thead>
          <tbody>${recordRows || `<tr><td colspan="7">No rows detected.</td></tr>`}</tbody>
        </table>
      </body>
    </html>`;
}

function formatOptionalCurrency(value) {
  return value === null || value === undefined ? "-" : formatCurrency(value);
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
    "component-sum": "Sum of detected components",
    "company-balance-sum": "Sum of latest company balances",
    "last-row-balance": "Last passbook row balance"
  }[value] || value;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function setLocalImportStatus(message) {
  if (localImportStatus) {
    localImportStatus.textContent = message;
  }
}

function formatImportedAt(value) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
