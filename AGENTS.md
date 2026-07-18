# personalprojects

## Cursor Cloud specific instructions

### Repository layout (important)

The `main` branch is intentionally almost empty (just `README.md` and this file). Each
product lives on its own, **unmerged** feature branch. To work on or run a product you must
first check out its branch (or add a `git worktree`):

| Product | Branch | Stack | Web UI? |
| --- | --- | --- | --- |
| Personal Wealth Dashboard (NPS) | `cursor/nps-wealth-dashboard-8f79` | Python / Streamlit | Yes (Streamlit, port 8501) |
| EPFO Balance Dashboard | `cursor/epfo-balance-webapp-b2b6` | Node.js (stdlib only) | Yes (static, port 5173) |
| Daily Job Sponsorship Agent | `cursor/job-sponsorship-agent-d442` | Python (stdlib only) | No (CLI) |
| Daily Remote India Finance Jobs | `cursor/daily-remote-india-jobs-ffc1` | Python (stdlib only) | No (static-site generator) |

Example: `git worktree add ../nps origin/cursor/nps-wealth-dashboard-8f79` then work in `../nps`.

### Toolchain / environment

- The VM ships **Python 3.12** and **Node 22 / npm 10**, which satisfy every product
  (Python products need >= 3.10 / >= 3.11; the Node app uses only `node:` builtins).
- Only the **NPS dashboard** has third-party Python dependencies (Streamlit, pandas, plotly,
  pypdf, google-*). The other three products have **no runtime dependencies at all**.
- `pip` has no writable system site-packages, so `pip install` automatically installs into
  the **user site** (`~/.local`). Console scripts (e.g. `streamlit`, `pytest`) land in
  `~/.local/bin`, which is **not on `PATH`**. Always invoke them as modules:
  `python3 -m streamlit ...`, `python3 -m pytest`.
- No API keys or secrets are required for local development or testing of any product.
- There is no configured linter/formatter (no ruff/flake8/black/eslint). "Lint" effectively
  means running the test suite (and `python3 -m py_compile` / `node --check` if needed).

### Per-product run & test

Standard commands are documented in each branch's `README.md` / `package.json` / `pyproject.toml`;
the non-obvious deltas for this VM are captured here.

**NPS Wealth Dashboard** (`cursor/nps-wealth-dashboard-8f79`)
- Deps come from `pyproject.toml`: `pip install --user -e ".[dev]"`.
- Test: `python3 -m pytest -q`.
- Run: `python3 -m streamlit run app.py --server.port 8501 --server.headless true`.
- The **"Upload NPS statement" tab works fully offline** — no Gmail OAuth needed. Gmail
  fetch is optional and requires a `credentials.json` OAuth client you provide yourself.
- The parser only accepts holding rows where `units * NAV` reconciles with the reported
  market value (within tolerance), which filters out contribution/transaction rows.

**EPFO Balance Dashboard** (`cursor/epfo-balance-webapp-b2b6`)
- No dependencies; `npm install` is a no-op but harmless.
- Test: `npm test` (`node --test`).
- Run: `npm start` (serves on `PORT`, default 5173). The in-app **"Load sample"** button
  parses a bundled sample passbook — a good zero-input smoke test of the dashboard.

**Daily Job Sponsorship Agent** (`cursor/job-sponsorship-agent-d442`)
- Test: `python3 -m unittest discover tests`.
- Deterministic offline run: `python3 -m job_sponsor_agent.cli --input-json <postings.json>`.
- Live run (hits public job APIs): `python3 -m job_sponsor_agent.cli --output report.md`.
- Profile is optional: it falls back to `config/profile.example.json` (with a warning).

**Daily Remote India Finance Jobs** (`cursor/daily-remote-india-jobs-ffc1`)
- Test: `python3 -m unittest tests.test_publish_daily_jobs`.
- Run: `python3 scripts/publish_daily_jobs.py` — writes `docs/index.html`,
  `docs/job-postings.md`, `docs/jobs.json`. It fetches live public feeds but **degrades
  gracefully** and still writes valid output when a feed is unreachable, so it is safe
  offline.

### Notes

- The GitHub Actions workflows (scheduled cron, Pages, Issues) are cloud-only automation and
  are not needed for local development or testing.
- The startup update script installs NPS deps only when a `pyproject.toml` is present in the
  checked-out branch, so it is a no-op on the empty `main` branch.
