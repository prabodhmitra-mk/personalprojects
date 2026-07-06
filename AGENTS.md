# personalprojects

## Cursor Cloud specific instructions

### Repository layout (important)

The `main` branch is intentionally almost empty (just `README.md` and this file). The
actual products live on separate, unmerged feature branches. To work on or run a product
you must first check out its branch (or use a `git worktree`):

| Product | Branch | Type |
| --- | --- | --- |
| Daily Remote India Finance Jobs | `cursor/daily-remote-india-jobs-ffc1` | Static-site generator (`scripts/publish_daily_jobs.py`) |
| Daily Job Sponsorship Agent | `cursor/job-sponsorship-agent-d442` | CLI package (`job_sponsor_agent/`, `pyproject.toml`) |

### Environment

- Both products are **pure Python standard library** — there are no third-party runtime
  dependencies to install. Product 2 requires **Python >= 3.11** (`zoneinfo`, `X | Y`
  typing); the VM ships Python 3.12, which satisfies both products.
- There is no linter/formatter configured (no ruff/flake8/black). "Lint" is effectively
  `python3 -m py_compile` / running the `unittest` suite.

### Product 1 — Daily Remote India Finance Jobs (`cursor/daily-remote-india-jobs-ffc1`)

- Tests (offline): `python3 -m unittest tests.test_publish_daily_jobs`
- Run / generate site: `python3 scripts/publish_daily_jobs.py` — writes `docs/index.html`,
  `docs/job-postings.md`, `docs/jobs.json`. Open `docs/index.html` in a browser to view.
- The run fetches live public job feeds (Remotive / Remote OK / Arbeitnow). Network is
  available in the VM, but the script **degrades gracefully** and still writes valid
  (possibly empty) output if a feed is unreachable, so it is safe to run offline.

### Product 2 — Daily Job Sponsorship Agent (`cursor/job-sponsorship-agent-d442`)

- Tests (offline): `python3 -m unittest discover tests`
- Deterministic offline run (no network): `python3 -m job_sponsor_agent.cli --input-json <postings.json>`
  where the JSON is an array of postings (`source,title,company,url,location,description,tags,published_at`).
- Live run: `python3 -m job_sponsor_agent.cli --output reports/daily-job-matches.md`
- Profile is optional: it falls back to `config/profile.example.json` (prints a warning) if
  `config/profile.json` / `JOB_AGENT_PROFILE_JSON` are absent. Copy the example to create
  a real one: `cp config/profile.example.json config/profile.json`.
- `pip install -e .` works and exposes a `job-sponsor-agent` console script, but it lands in
  `~/.local/bin` which is **not on PATH** in this VM. Prefer invoking via
  `python3 -m job_sponsor_agent.cli`, which needs no install.

### Notes

- No API keys or secrets are required for either product; all job feeds are public.
- The GitHub Actions workflows (scheduled cron, GitHub Pages, GitHub Issues) are cloud-only
  automation and are not needed for local development or testing.
