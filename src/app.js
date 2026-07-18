import { formatCurrency, parsePassbookInput } from "./epfoParser.js";

const EPFO_PASSBOOK_URL = "https://passbook.epfindia.gov.in/MemberPassBook/Login";

const openPortalButton = document.querySelector("#open-portal");
const fileInput = document.querySelector("#passbook-file");
const passbookInput = document.querySelector("#passbook-input");
const parseButton = document.querySelector("#parse-passbook");
const clearButton = document.querySelector("#clear-data");
const sampleButton = document.querySelector("#load-sample");
const statusMessage = document.querySelector("#status-message");
const dashboard = document.querySelector("#dashboard");
const totalBalance = document.querySelector("#total-balance");
const confidence = document.querySelector("#confidence");
const source = document.querySelector("#source");
const componentList = document.querySelector("#component-list");
const warningList = document.querySelector("#warning-list");
const recordList = document.querySelector("#record-list");

openPortalButton.addEventListener("click", () => {
  window.open(EPFO_PASSBOOK_URL, "_blank", "noopener,noreferrer");
  setStatus("Opened the official EPFO passbook portal in a new tab. Log in there, then copy the passbook table or downloaded HTML/text here.");
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
  dashboard.hidden = true;
  setStatus("Cleared imported passbook content from this page.");
});

sampleButton.addEventListener("click", () => {
  passbookInput.value = `EPFO Member Passbook
Member ID: PYBOM00012340000001234
Employee Share Balance: Rs. 82,450
Employer Share Balance: Rs. 71,220
Pension Contribution: Rs. 23,180
Total Balance: Rs. 1,76,850

Wage Month Employee Share Employer Share Pension Share Balance
Jan-2026 1,800 550 1,250 1,72,000
Feb-2026 1,850 565 1,285 1,76,850`;
  parseAndRender();
});

function parseAndRender() {
  const result = parsePassbookInput(passbookInput.value);

  if (!result.totalBalance) {
    dashboard.hidden = true;
    setStatus(result.warnings[0] || "Could not detect a balance. Paste the full passbook text and try again.");
    return;
  }

  totalBalance.textContent = result.formattedTotalBalance;
  confidence.textContent = `${Math.round(result.confidence * 100)}%`;
  source.textContent = formatSource(result.balanceSource);
  renderComponents(result.components);
  renderWarnings(result.warnings);
  renderRecords(result.records);

  dashboard.hidden = false;
  setStatus(`Detected ${result.formattedTotalBalance} from ${result.lineCount} imported lines. Review it against EPFO before relying on it.`);
}

function renderComponents(components) {
  componentList.innerHTML = "";

  for (const [label, value] of Object.entries(components)) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${formatComponentLabel(label)}</span><strong>${value === null ? "Not found" : formatCurrency(value)}</strong>`;
    componentList.append(item);
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
    recordList.innerHTML = `<tr><td colspan="5">No monthly rows detected.</td></tr>`;
    return;
  }

  for (const record of records) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${record.period}</td>
      <td>${formatOptionalCurrency(record.employeeShare)}</td>
      <td>${formatOptionalCurrency(record.employerShare)}</td>
      <td>${formatOptionalCurrency(record.pensionShare)}</td>
      <td>${formatOptionalCurrency(record.rowBalance)}</td>
    `;
    recordList.append(row);
  }
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
    "last-row-balance": "Last passbook row balance"
  }[value] || value;
}

function setStatus(message) {
  statusMessage.textContent = message;
}
