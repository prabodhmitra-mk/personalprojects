# Daily remote finance jobs for India

This repository publishes a daily list of worldwide or India-compatible work-from-home jobs in:

- Finance
- Credit underwriting
- Risk analysis
- Accounts and accounting
- Taxation
- Return-to-work / returnee mother opportunities

The report is generated from public remote-job feeds and written to `docs/` as:

- `docs/index.html` - static page for GitHub Pages
- `docs/job-postings.md` - Markdown report
- `docs/jobs.json` - structured data

## Schedule

The GitHub Actions workflow in `.github/workflows/daily-job-postings.yml` runs every day at **1:00 PM IST** (`07:30 UTC`) and can also be started manually with `workflow_dispatch`.

## Run locally

```bash
python scripts/publish_daily_jobs.py
```

The script has no required API keys or third-party Python packages.
