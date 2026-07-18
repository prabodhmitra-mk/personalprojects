# EPFO Balance Dashboard

A small privacy-first web app that helps you get total values from your EPFO passbook and NPS holdings/statement.

## How it works

1. Start the app locally.
2. Click **Open EPFO passbook portal**.
3. Log in on the official EPFO website yourself, including CAPTCHA/OTP.
4. Either:
   - use the browser extension to import the visible EPFO page automatically, or
   - copy the passbook table/page text or save an HTML/TXT/CSV export manually.
5. Click **Get total balance** if you imported manually. Extension imports are parsed automatically.
6. Optionally enter a manual PF projection baseline: current PF balance plus last month employee/employer contribution.
7. Import NPS from email attachments or manually import copied/downloaded NPS holdings or statement content.
8. Optionally click **Ask local LLM** if the rule-based PF parser cannot understand a changed EPFO format.
9. Review PF, projected PF, NPS, and combined portfolio totals.
10. Click **Download local XLS** to save an Excel-compatible workbook on your machine.

The app does not store your EPFO password and does not try to bypass EPFO login security.
Imported PF/NPS content is processed locally in the browser tab.

## Avoid manual download/upload with the browser extension

The repository includes a local Chrome/Edge extension in the `extension/` folder.

Use this flow:

1. Start the dashboard:

   ```bash
   npm start
   ```

2. Open Chrome or Edge extensions:

   ```text
   chrome://extensions
   ```

   or:

   ```text
   edge://extensions
   ```

3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this repository's `extension/` folder.
6. Open the dashboard at:

   ```text
   http://localhost:5173
   ```

7. Open the official EPFO passbook portal from the dashboard.
8. Log in manually and solve CAPTCHA/OTP yourself.
9. Open the passbook page you want to import.
10. The extension shows a small **Passbook detected** prompt on the EPFO page.
11. Click **Import to dashboard** in that prompt.

The extension sends the visible EPFO page text to `http://localhost:5173/api/import`.
The dashboard polls that local endpoint and parses the imported content automatically.

Chrome/Edge do not allow extensions to open their toolbar popup automatically, so the extension uses an in-page prompt instead.
You can still click the extension icon manually if the prompt does not appear.

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

This is only an estimate. Click **Validate by logging into EPFO** to open EPFO manually and compare against the official current balance.

The Excel workbook includes a `PF Projection` sheet with:

- Saved current balance.
- Last month employee contribution.
- Last month employer contribution.
- Assumed monthly deposit.
- Completed months elapsed.
- Projected PF balance.
- Validation reminder.

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

## Optional local LLM fallback

The dashboard can ask a local Ollama-compatible LLM to extract EPFO balance data as strict JSON.
This is useful when EPFO changes labels/layout and the rule-based parser needs help.

Install and run Ollama locally, then pull a small model:

```bash
ollama pull llama3.2:1b
```

Start the dashboard:

```bash
npm start
```

After importing EPFO page content, click **Ask local LLM**.

Notes:

- The dashboard calls `http://127.0.0.1:11434/api/generate` through the local Node server.
- The server only allows local Ollama URLs.
- The LLM result is shown as an assistive fallback and should be verified against EPFO.
- If you prefer a different installed local model, edit the model input in the dashboard.

## Run locally

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

## Why the app does not directly scrape EPFO

A normal web app cannot silently read data from another logged-in website because of browser cross-origin protections.
EPFO authentication also includes user-facing security controls such as CAPTCHA/OTP.

This app therefore uses a safer assisted flow: it opens the official EPFO portal, lets you authenticate there, and then parses passbook content you explicitly import.
The browser extension reduces the manual import step, but it still requires you to log in and confirm import intentionally.

## What the dashboard detects

- Combined PF + NPS value.
- Total EPFO/PF balance.
- Projected PF balance from saved manual baseline.
- PF employee contribution total.
- PF employer contribution total.
- PF pension/EPS contribution total.
- PF company-wise totals across detected member IDs.
- Recent PF passbook rows.
- Total NPS value.
- NPS contribution total, when available.
- NPS holdings.
- Optional local LLM extraction result when enabled.

The generated `.xls` workbook is created locally in the browser from the parsed PF/NPS data.
It contains separate sheets for:

- `Summary`
- `PF Summary`
- `PF Projection`
- `PF Company Wise`
- `PF Rows`
- `NPS Summary`
- `NPS Holdings`
