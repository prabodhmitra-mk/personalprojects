chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EPFO_EXTRACT_PASSBOOK") {
    return false;
  }

  const pageText = document.body?.innerText?.trim() || "";

  sendResponse({
    ok: pageText.length > 0,
    pageText,
    sourceUrl: window.location.href,
    title: document.title || "EPFO passbook"
  });

  return false;
});
