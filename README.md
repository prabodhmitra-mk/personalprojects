# EPFO Balance Dashboard

A small privacy-first web app that helps you get a total balance from your EPFO passbook.

## How it works

1. Start the app locally.
2. Click **Open EPFO passbook portal**.
3. Log in on the official EPFO website yourself, including CAPTCHA/OTP.
4. Either:
   - use the browser extension to import the visible EPFO page automatically, or
   - copy the passbook table/page text or save an HTML/TXT/CSV export manually.
5. Click **Get total balance** if you imported manually. Extension imports are parsed automatically.
6. Review company-wise employee/employer/pension totals.
7. Click **Download local XLS** to save an Excel-compatible file on your machine.

The app does not store your EPFO password and does not try to bypass EPFO login security.
Imported passbook content is processed in the browser tab.

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
10. Click the **EPFO Local Importer** extension icon.
11. Click **Import visible passbook**.

The extension sends the visible EPFO page text to `http://localhost:5173/api/import`.
The dashboard polls that local endpoint and parses the imported content automatically.

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
The browser extension reduces the manual import step, but it still requires you to log in and click import intentionally.

## What the dashboard detects

- Total EPFO balance.
- Employee contribution total.
- Employer contribution total.
- Pension/EPS contribution total.
- Company-wise totals across detected member IDs.
- Recent passbook rows.

The generated `.xls` file is created locally in the browser from the parsed passbook data.
