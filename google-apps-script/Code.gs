function doPost(e) {
  try {
    const payload = JSON.parse(e.parameter.payload || "{}");
    const spreadsheet = getOrCreateSpreadsheet_(payload);

    writeSheet_(spreadsheet, "Summary", payload.summaryRows || []);
    writeSheet_(spreadsheet, "PF Projection", payload.pfProjectionRows || []);
    writeSheet_(spreadsheet, "NPS Summary", payload.npsSummaryRows || []);
    writeSheet_(spreadsheet, "NPS Holdings", payload.npsHoldingsRows || []);
    appendHistory_(spreadsheet, payload.historyRow || []);

    return HtmlService.createHtmlOutput(
      "<p>Portfolio tracker updated.</p>" +
      "<p>Spreadsheet ID: <code>" + spreadsheet.getId() + "</code></p>" +
      "<p><a target=\"_blank\" href=\"" + spreadsheet.getUrl() + "\">Open Google Sheet</a></p>" +
      "<p>Copy the Spreadsheet ID back into the web app to update this same sheet next time.</p>"
    );
  } catch (error) {
    return HtmlService.createHtmlOutput(
      "<p>Could not update portfolio tracker.</p><pre>" + String(error && error.stack || error) + "</pre>"
    );
  }
}

function getOrCreateSpreadsheet_(payload) {
  if (payload.spreadsheetId) {
    return SpreadsheetApp.openById(payload.spreadsheetId);
  }

  return SpreadsheetApp.create(payload.spreadsheetName || "PF NPS Portfolio Tracker");
}

function writeSheet_(spreadsheet, name, rows) {
  const sheet = getSheet_(spreadsheet, name);
  sheet.clearContents();

  if (!rows.length) {
    return;
  }

  sheet.getRange(1, 1, rows.length, maxColumns_(rows)).setValues(padRows_(rows));
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, maxColumns_(rows));
}

function appendHistory_(spreadsheet, row) {
  const sheet = getSheet_(spreadsheet, "Update History");
  const header = ["Updated At", "PF Value", "NPS Value", "Combined Value", "PF Source", "NPS Source"];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow(row.length ? row : [new Date().toISOString(), "", "", "", "", ""]);
  sheet.autoResizeColumns(1, header.length);
}

function getSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function maxColumns_(rows) {
  return rows.reduce(function (max, row) {
    return Math.max(max, row.length);
  }, 1);
}

function padRows_(rows) {
  const width = maxColumns_(rows);
  return rows.map(function (row) {
    const padded = row.slice();
    while (padded.length < width) {
      padded.push("");
    }
    return padded;
  });
}
