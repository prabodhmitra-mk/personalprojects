# personalprojects

## Daily job sponsorship agent

This repository contains a small Python agent that scans public worldwide/remote
job APIs, matches postings to your profile, and curates roles that either:

- mention visa/permit sponsorship or relocation support, or
- are remote/global/India-friendly enough to be performed with India work
  authorization.

The scheduled GitHub Action runs every day at **7:00 PM IST** and creates a
GitHub issue containing the curated report. The report is also written to the
workflow summary and uploaded as an artifact.

### Configure your profile

Copy the example profile and edit it with your real details:

```bash
cp config/profile.example.json config/profile.json
```

For GitHub Actions, add a repository secret named `JOB_AGENT_PROFILE_JSON` with
the JSON contents of your profile. This avoids committing personal details.

Key fields:

- `target_titles`: roles you want, for example `backend engineer`.
- `skills`: technologies and domain keywords that should score higher.
- `preferred_locations`: countries or regions you prefer.
- `work_permission_countries`: keep `india` unless your authorization changes.
- `minimum_score`: raise for fewer results, lower for broader results.
- `max_results`: maximum rows in the daily curated list.

### Run locally

```bash
python3 -m job_sponsor_agent.cli --output reports/daily-job-matches.md
```

To test scoring with your own normalized postings instead of live APIs:

```bash
python3 -m job_sponsor_agent.cli --input-json sample-postings.json
```

### Job sources

The agent uses public APIs from Remotive, Remote OK, and Arbeitnow. It does not
scrape pages or bypass job board restrictions.

### Sponsorship matching caveat

The agent filters for sponsorship/relocation keywords and global remote
eligibility signals. Always confirm the employer's current immigration policy
before applying.
