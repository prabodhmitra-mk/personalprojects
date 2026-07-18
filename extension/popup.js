const dashboardUrl = "http://localhost:5173";
const statusElement = document.querySelector("#status");
const importButton = document.querySelector("#import-passbook");
const openDashboardButton = document.querySelector("#open-dashboard");

importButton.addEventListener("click", importVisiblePassbook);
openDashboardButton.addEventListener("click", () => {
  chrome.tabs.create({ url: dashboardUrl });
});

async function importVisiblePassbook() {
  setStatus("Reading the active EPFO tab...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !tab.url?.startsWith("https://passbook.epfindia.gov.in/")) {
      setStatus("Open the EPFO passbook tab first, then click this extension again.");
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "EPFO_EXTRACT_PASSBOOK"
    });

    if (!response?.ok || !response.pageText) {
      setStatus("Could not read visible passbook text. Refresh the EPFO tab and try again.");
      return;
    }

    setStatus("Sending visible EPFO text to local dashboard...");

    const importResponse = await fetch(`${dashboardUrl}/api/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pageText: response.pageText,
        sourceUrl: response.sourceUrl,
        title: response.title
      })
    });

    const result = await importResponse.json();
    if (!importResponse.ok || !result.ok) {
      setStatus(result.error || "Local dashboard rejected the import.");
      return;
    }

    setStatus(`Imported ${result.length.toLocaleString("en-IN")} characters. Opening dashboard...`);
    chrome.tabs.create({ url: dashboardUrl });
  } catch (error) {
    setStatus(`Import failed: ${error.message}`);
  }
}

function setStatus(message) {
  statusElement.textContent = message;
}
