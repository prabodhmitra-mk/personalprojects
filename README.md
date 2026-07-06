# Personal Wealth Dashboard

First version of a local financial dashboard. It can:

- connect to a Gmail account with read-only OAuth access,
- search for PDF attachments from a specific sender,
- download those statement PDFs locally,
- decrypt a password-protected NPS Tier 1 statement,
- parse the current holdings and total corpus, and
- render a Streamlit dashboard for the NPS wealth allocation.

The app also supports direct PDF upload, so you can test the parser before Gmail OAuth is configured.

## Project structure

```text
app.py                              Streamlit UI
src/wealth_dashboard/gmail_client.py Gmail OAuth and attachment download
src/wealth_dashboard/pdf_reader.py   Password-protected PDF text extraction
src/wealth_dashboard/nps_parser.py   NPS Tier 1 statement parser
tests/                               Focused parser tests
```

## Local setup

Use Python 3.10 or newer.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

Update `.env` with local defaults if you want the UI fields prefilled. Do not commit real passwords, OAuth tokens, or downloaded financial statements.

## Gmail OAuth setup

1. In Google Cloud Console, create an OAuth client for a desktop app.
2. Enable the Gmail API for that project.
3. Download the OAuth client JSON as `credentials.json` in the repository root, or set `GMAIL_CREDENTIALS_PATH` in `.env`.
4. Start the app and click **Fetch PDF attachments from Gmail**. The first run opens the OAuth consent flow and stores a local `token.json`.

The app requests only this Gmail scope:

```text
https://www.googleapis.com/auth/gmail.readonly
```

## Run the dashboard

```bash
streamlit run app.py
```

In the sidebar:

1. Enter the NPS statement PDF password.
2. Enter the statement sender email address.
3. Optionally add Gmail search terms, such as `subject:"NPS" newer_than:90d`.
4. Fetch PDF attachments from Gmail and parse the selected statement.

You can also use the **Upload NPS statement** tab to upload a PDF manually.

## Parser notes

NPS PDF text extraction can vary by statement provider and PDF layout. This first parser looks for current holding rows that include:

```text
scheme name | units | NAV | market value
```

It validates rows by checking that `units * NAV` is close to the reported market value, which helps avoid transaction-history rows. If a real statement layout differs, add a redacted text sample to a test and adjust `src/wealth_dashboard/nps_parser.py`.

Image-scanned PDFs are not supported yet because they require OCR.

## Tests

```bash
pytest
```
