# EPFO Balance Dashboard

A small privacy-first web app that helps you get a total balance from your EPFO passbook.

## How it works

1. Start the app locally.
2. Click **Open EPFO passbook portal**.
3. Log in on the official EPFO website yourself, including CAPTCHA/OTP.
4. Copy the passbook table/page text or save an HTML/TXT/CSV export.
5. Paste or upload that content into this app.
6. Click **Get total balance**.
7. Review company-wise employee/employer/pension totals.
8. Click **Download local XLS** to save an Excel-compatible file on your machine.

The app does not store your EPFO password and does not try to bypass EPFO login security.
Imported passbook content is processed in the browser tab.

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

## What the dashboard detects

- Total EPFO balance.
- Employee contribution total.
- Employer contribution total.
- Pension/EPS contribution total.
- Company-wise totals across detected member IDs.
- Recent passbook rows.

The generated `.xls` file is created locally in the browser from the parsed passbook data.
