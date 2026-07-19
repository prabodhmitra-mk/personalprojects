# PF and NPS Portfolio Dashboard

A small privacy-first web app that helps you project PF value, import NPS holdings/statement data, and export a combined Excel workbook.

## How it works

1. Start the app locally.
2. Enter a manual PF projection baseline: current PF balance plus last month employee/employer contribution.
3. Configure optional Google Sheets/Drive storage using the included Apps Script.
4. Import NPS from email attachments or manually import copied/downloaded NPS holdings or statement content.
5. Review projected PF, NPS, and combined portfolio totals.
6. Click **Download local XLS** or **Save current data to Google Sheets**.

The app does not store your EPFO, NPS, or email credentials. Imported NPS content is processed locally.

## Manual PF projection baseline

If you do not want to import EPFO every time, use the **Manual PF projection baseline** section:

1. Enter your current official PF balance.
2. Enter last month employee contribution.
3. Enter last month employer contribution.
4. Click **Save PF projection baseline**.

The app saves this baseline in browser local storage and, on future app opens, estimates current PF balance as:

```text
saved PF balance + completed months since save date * (employee contribution + employer contribution)
```

This is only an estimate. Validation is optional but recommended: click **Optional: validate in EPFO** to open EPFO manually and compare against the official current balance.

The Excel workbook includes a `PF Projection` sheet with:

- Saved current balance.
- Last month employee contribution.
- Last month employer contribution.
- Assumed monthly deposit.
- Completed months elapsed.
- Projected PF balance.
- Optional validation recommendation.

## Save to Google Sheets / Google Drive

The app can save PF/NPS data into a Google Sheet in your Drive through a Google Apps Script that you own.
This avoids shipping Google OAuth credentials inside the local app.

### One-time setup

1. Open Google Apps Script:

   ```text
   https://script.google.com
   ```

2. Create a new project.
3. Copy the contents of:

   ```text
   google-apps-script/Code.gs
   ```

   into the Apps Script editor.

4. Deploy it as a Web App:
   - Execute as: **Me**
   - Who has access: **Only myself**

5. Copy the Web App URL.
6. Paste it into **Apps Script Web App URL** in this app.
7. Click **Save current data to Google Sheets**.

If **Spreadsheet ID** is blank, the script creates a new Google Sheet and opens a result page with the new Spreadsheet ID.
Copy that ID back into this app so future saves update the same sheet.

### Google Sheet tabs

The Google Sheet contains:

- `Summary`
- `PF Projection`
- `NPS Summary`
- `NPS Holdings`
- `Update History`

The `Update History` tab appends a new row each time data is saved, including last updated time, PF value, NPS value, and combined value.

If **Auto-save after PF/NPS updates** is checked and a Spreadsheet ID is set, the app submits updates after saving PF projection data or parsing NPS data.

## Import NPS data

### Option 1: Read NPS statements from email

Use the NPS email section in the dashboard:

1. Enter IMAP host/port. For Gmail, use:

   ```text
   imap.gmail.com
   ```

2. Enter your email username.
3. Enter your email/app password. For Gmail, this usually means a Google app password with IMAP enabled.
4. Keep subject keywords as:

   ```text
   nps,statement
   ```

5. Enter the NPS attachment/PDF password.
6. Click **Read NPS email statement**.

The local server searches recent emails whose subject contains all configured keywords, reads supported attachments, extracts statement text, and runs the NPS parser.

Supported attachment types:

- Password-protected PDF
- Text
- HTML
- CSV

Security notes:

- Email credentials and attachment password are sent only to the local `npm start` server for that request.
- They are not saved in local storage or written to disk by the app.
- Use an app password instead of your main mailbox password where possible.

### Option 2: Manual NPS import

Use the manual NPS section in the dashboard:

1. Click **Open NPS CRA portal**.
2. Log in manually on the official NPS site.
3. Copy or export your holdings/statement content.
4. Paste or upload it in the NPS import section.
5. Click **Get NPS value**.

The NPS parser detects:

- Total NPS corpus/current value.
- Total contribution, when available.
- PRAN, when available.
- Holding rows with tier, scheme, units, NAV, and current value.

## Run locally

Install dependencies first, especially after pulling new changes:

```bash
npm install
```

Then start the app:

```bash
npm start
```

Then open:

```text
http://localhost:5173
```

## Run tests

```bash
npm test
```

## Troubleshooting

### Cannot find package `imapflow`

If `npm start` shows:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'imapflow'
```

run:

```bash
npm install
```

Then start again:

```bash
npm start
```

The NPS email importer uses `imapflow`, `mailparser`, and `pdfjs-dist`. They are installed from `package.json`/`package-lock.json`.

## What the dashboard detects

- Combined PF + NPS value.
- Projected PF balance from saved manual baseline.
- PF monthly deposit assumption.
- PF projection months elapsed.
- Total NPS value.
- NPS contribution total, when available.
- NPS holdings.

The generated `.xls` workbook is created locally in the browser from the parsed PF/NPS data.
It contains separate sheets for:

- `Summary`
- `PF Summary`
- `PF Projection`
- `NPS Summary`
- `NPS Holdings`
