const DASHBOARD_URL = "http://localhost:5173";
const WIDGET_ID = "epfo-local-importer-widget";
const STYLE_ID = "epfo-local-importer-style";

let detectionTimer = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EPFO_EXTRACT_PASSBOOK") {
    return false;
  }

  const pageText = getVisiblePageText();

  sendResponse({
    ok: pageText.length > 0,
    pageText,
    sourceUrl: window.location.href,
    title: document.title || "EPFO passbook"
  });

  return false;
});

scheduleDetection();

const observer = new MutationObserver(() => {
  scheduleDetection();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

function scheduleDetection() {
  window.clearTimeout(detectionTimer);
  detectionTimer = window.setTimeout(showWidgetIfPassbookIsVisible, 700);
}

function showWidgetIfPassbookIsVisible() {
  if (document.getElementById(WIDGET_ID) || !looksLikePassbookPage(getVisiblePageText())) {
    return;
  }

  injectStyle();

  const widget = document.createElement("section");
  widget.id = WIDGET_ID;
  widget.innerHTML = `
    <div class="epfo-local-importer-card">
      <p class="epfo-local-importer-eyebrow">EPFO Local Importer</p>
      <strong>Passbook detected</strong>
      <p>Import the visible passbook into your local dashboard and generate company-wise totals/XLS.</p>
      <div class="epfo-local-importer-actions">
        <button type="button" data-action="import">Import to dashboard</button>
        <button type="button" data-action="open">Open dashboard</button>
        <button type="button" data-action="dismiss" aria-label="Dismiss">Dismiss</button>
      </div>
      <p class="epfo-local-importer-status">Nothing is sent until you click import.</p>
    </div>
  `;

  widget.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;

    if (action === "import") {
      importVisiblePassbook(widget);
    }

    if (action === "open") {
      window.open(DASHBOARD_URL, "_blank", "noopener,noreferrer");
    }

    if (action === "dismiss") {
      widget.remove();
    }
  });

  document.documentElement.append(widget);
}

async function importVisiblePassbook(widget) {
  const statusElement = widget.querySelector(".epfo-local-importer-status");
  const importButton = widget.querySelector("[data-action='import']");

  importButton.disabled = true;
  statusElement.textContent = "Sending visible EPFO page text to local dashboard...";

  try {
    const response = await fetch(`${DASHBOARD_URL}/api/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pageText: getVisiblePageText(),
        sourceUrl: window.location.href,
        title: document.title || "EPFO passbook"
      })
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Local dashboard rejected the import.");
    }

    statusElement.textContent = `Imported ${result.length.toLocaleString("en-IN")} characters. Opening dashboard...`;
    window.open(DASHBOARD_URL, "_blank", "noopener,noreferrer");
  } catch (error) {
    importButton.disabled = false;
    statusElement.textContent = `Import failed: ${error.message}. Make sure the dashboard is running with npm start.`;
  }
}

function looksLikePassbookPage(pageText) {
  return /passbook|member\s+id|establishment|wage\s+month/i.test(pageText)
    && /employee\s+share|employer\s+share|ee\s+share|er\s+share/i.test(pageText)
    && /balance|pension|eps/i.test(pageText);
}

function getVisiblePageText() {
  const widget = document.getElementById(WIDGET_ID);
  const previousDisplay = widget?.style.display;

  if (widget) {
    widget.style.display = "none";
  }

  const pageText = document.body?.innerText?.trim() || "";

  if (widget) {
    widget.style.display = previousDisplay || "";
  }

  return pageText;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${WIDGET_ID} {
      all: initial;
      bottom: 18px;
      box-sizing: border-box;
      color: #102033;
      font-family: Inter, Arial, sans-serif;
      position: fixed;
      right: 18px;
      width: min(360px, calc(100vw - 36px));
      z-index: 2147483647;
    }

    #${WIDGET_ID} * {
      box-sizing: border-box;
      font-family: inherit;
    }

    #${WIDGET_ID} .epfo-local-importer-card {
      background: #ffffff;
      border: 1px solid #dbe5f3;
      border-radius: 16px;
      box-shadow: 0 18px 55px rgba(16, 32, 51, 0.22);
      padding: 16px;
    }

    #${WIDGET_ID} .epfo-local-importer-eyebrow {
      color: #1769e0;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin: 0 0 6px;
      text-transform: uppercase;
    }

    #${WIDGET_ID} strong {
      color: #102033;
      display: block;
      font-size: 20px;
      margin-bottom: 6px;
    }

    #${WIDGET_ID} p {
      color: #65758b;
      font-size: 13px;
      line-height: 1.45;
      margin: 0 0 12px;
    }

    #${WIDGET_ID} .epfo-local-importer-actions {
      display: grid;
      gap: 8px;
    }

    #${WIDGET_ID} button {
      background: #ffffff;
      border: 1px solid #dbe5f3;
      border-radius: 10px;
      color: #102033;
      cursor: pointer;
      font-size: 13px;
      font-weight: 800;
      padding: 10px 12px;
    }

    #${WIDGET_ID} button[data-action="import"] {
      background: #1769e0;
      border-color: #1769e0;
      color: #ffffff;
    }

    #${WIDGET_ID} button:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    #${WIDGET_ID} .epfo-local-importer-status {
      background: #f7faff;
      border-radius: 10px;
      color: #102033;
      margin: 10px 0 0;
      padding: 10px;
    }
  `;

  document.documentElement.append(style);
}
