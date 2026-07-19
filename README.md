# Wealth Management Dashboard

A small privacy-first wealth dashboard that helps you store PF/NPS data in a local file on your laptop and export a combined PF/NPS workbook.

## How it works

1. Start the app locally.
2. Create or open a local wealth file on your laptop.
3. Enter a manual PF projection baseline: current PF balance plus last month employee/employer contribution.
4. Import NPS from email statement attachments.
5. Review projected PF, NPS, and combined portfolio totals.
6. Click **Download local XLS** if you want an Excel copy.

The app does not store your EPFO, NPS, or email credentials. Wealth data is saved in the local file you select.

## Local wealth file

Use the **Local wealth file** section first:

1. Click **Create wealth file** to choose where to save your dashboard data, or **Open existing wealth file**.
2. The app stores PF and NPS data in that JSON file.
3. On future opens, the app tries to read the same file automatically if the browser still has permission.
4. If permission is not available, click **Open existing wealth file** again.

Use Chrome or Edge for this feature because it relies on the browser's local file access API.

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

The app only adds PF deposits when one or more full months have elapsed. If fewer than one full month has passed, it does not add anything.

This is only an estimate. Validation is optional but recommended: click **Optional: validate in EPFO** to open EPFO manually and compare against the official current balance.

If the estimate looks right, click **Accept estimate and save**. That writes the estimated PF value back to your local wealth file.

The local wealth file and Excel workbook include:

- Saved current balance.
- Last month employee contribution.
- Last month employer contribution.
- Assumed monthly deposit.
- Completed months elapsed.
- Projected PF balance.
- Optional validation recommendation.

## Import NPS data from email

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
- `PF Projection`
- `NPS Summary`
- `NPS Holdings`
