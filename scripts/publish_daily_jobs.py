#!/usr/bin/env python3
"""Publish a daily remote-job report for India-compatible finance roles.

The script intentionally uses public feeds that do not require credentials. It
fetches remote postings, filters for finance/accounting/risk/tax/returnship
keywords, keeps only roles that appear compatible with working from India, and
writes static files under docs/ for GitHub Pages.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import textwrap
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
IST = timezone(timedelta(hours=5, minutes=30), "IST")
HTTP_TIMEOUT_SECONDS = 25
MAX_RESULTS = 80

SEARCH_QUERIES = [
    "finance",
    "credit underwriting",
    "risk analysis",
    "accounts",
    "accounting",
    "taxation",
    "tax",
    "returnship finance",
    "return to work finance",
    "career break finance",
    "mothers returnship",
]

ROLE_KEYWORDS = {
    "Finance": [
        "finance",
        "financial",
        "financial analyst",
        "fp&a",
        "treasury",
        "budget",
        "pricing analyst",
    ],
    "Credit underwriting": [
        "credit",
        "underwriting",
        "underwriter",
        "loan analyst",
        "lending",
        "mortgage",
        "collections",
        "recoveries",
    ],
    "Risk analysis": [
        "risk",
        "risk analyst",
        "credit risk",
        "fraud risk",
        "compliance risk",
    ],
    "Accounts": [
        "accounts",
        "accounting",
        "accountant",
        "bookkeeper",
        "accounts payable",
        "accounts receivable",
        "payroll",
    ],
    "Taxation": [
        "tax",
        "taxation",
        "gst",
        "vat",
        "return filing",
        "tax analyst",
    ],
    "Return-to-work": [
        "returnship",
        "return to work",
        "career break",
        "returner",
        "mothers",
        "mums",
        "women return",
        "second career",
    ],
}

REMOTE_TERMS = [
    "remote",
    "work from home",
    "work-from-home",
    "wfh",
    "distributed",
]

INDIA_COMPATIBLE_TERMS = [
    "india",
    "worldwide",
    "anywhere",
    "global",
    "international",
    "asia",
    "apac",
    "south asia",
    "remote only",
]

EXCLUSIVE_LOCATION_PATTERNS = [
    r"\busa\b",
    r"\bu\.s\.\b",
    r"\bus\b",
    r"\bunited states\b",
    r"\bus only\b",
    r"\bu\.s\. only\b",
    r"\bunited states only\b",
    r"\bcanada\b",
    r"\bcanada only\b",
    r"\buk\b",
    r"\buk only\b",
    r"\bunited kingdom\b",
    r"\bunited kingdom only\b",
    r"\beurope\b",
    r"\beurope only\b",
    r"\beu\b",
    r"\beu only\b",
    r"\beuropean union\b",
    r"\beuropean union only\b",
    r"\blatam\b",
    r"\blatam only\b",
    r"\bamericas\b",
    r"\bamericas only\b",
    r"\baustralia\b",
    r"\baustralia only\b",
    r"\bnew zealand\b",
    r"\bnew zealand only\b",
]

ASCII_REPLACEMENTS = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u00a0": " ",
    }
)


@dataclass(frozen=True)
class Job:
    title: str
    company: str
    location: str
    url: str
    source: str
    published_at: str
    categories: list[str]
    summary: str


def request_json(url: str) -> object:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "remote-india-finance-jobs/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = html.unescape(str(value))
    if "â" in text or "Ã" in text:
        try:
            text = text.encode("latin-1").decode("utf-8")
        except UnicodeError:
            pass
    text = text.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ")
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.translate(ASCII_REPLACEMENTS)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def contains_keyword(text: str, term: str) -> bool:
    normalized = text.casefold()
    keyword = re.escape(term.casefold())
    return re.search(rf"(?<![a-z0-9]){keyword}(?![a-z0-9])", normalized) is not None


def contains_any(text: str, terms: Iterable[str]) -> bool:
    return any(contains_keyword(text, term) for term in terms)


def is_exclusive_non_india_location(text: str) -> bool:
    normalized = text.casefold()
    compatible_terms = [term for term in INDIA_COMPATIBLE_TERMS if term != "remote only"]
    if contains_any(normalized, compatible_terms):
        return False
    return any(re.search(pattern, normalized) for pattern in EXCLUSIVE_LOCATION_PATTERNS)


def is_remote_india_compatible(location: str, searchable_text: str) -> bool:
    location_text = clean_text(location).casefold()
    combined = f"{location_text} {searchable_text.casefold()}"

    if is_exclusive_non_india_location(location_text):
        return False

    if contains_any(location_text, INDIA_COMPATIBLE_TERMS):
        return True

    # Some feeds use only "Remote" as the location. Keep those roles if the
    # posting text does not explicitly restrict the geography away from India.
    if contains_any(location_text, REMOTE_TERMS) and not is_exclusive_non_india_location(combined):
        return True

    if "india" in combined and contains_any(combined, REMOTE_TERMS):
        return True

    return False


def matching_categories(text: str) -> list[str]:
    matches = [
        category
        for category, keywords in ROLE_KEYWORDS.items()
        if contains_any(text, keywords)
    ]
    return matches


def summarize(text: str, max_length: int = 280) -> str:
    cleaned = clean_text(text)
    if len(cleaned) <= max_length:
        return cleaned
    return cleaned[: max_length - 1].rsplit(" ", 1)[0] + "..."


def parse_date(value: object) -> datetime:
    if value in (None, ""):
        return datetime.min.replace(tzinfo=timezone.utc)

    text = str(value)
    if text.isdigit():
        timestamp = int(text)
        if timestamp > 10_000_000_000:
            timestamp = timestamp // 1000
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)

    for candidate in (text, text.replace("Z", "+00:00")):
        try:
            return datetime.fromisoformat(candidate).astimezone(timezone.utc)
        except ValueError:
            continue

    return datetime.min.replace(tzinfo=timezone.utc)


def make_job(
    *,
    title: object,
    company: object,
    location: object,
    url: object,
    source: str,
    published_at: object,
    description: object,
    tags: object = "",
) -> Job | None:
    title_text = clean_text(title)
    company_text = clean_text(company) or "Unknown company"
    location_text = clean_text(location) or "Remote"
    url_text = clean_text(url)
    description_text = clean_text(description)
    tags_text = clean_text(tags)

    if not title_text or not url_text:
        return None

    primary_text = title_text
    description_only_text = f"{title_text} {tags_text} {description_text}"
    categories = matching_categories(primary_text)
    if contains_any(description_only_text, ROLE_KEYWORDS["Return-to-work"]):
        categories = sorted({*categories, "Return-to-work"}, key=list(ROLE_KEYWORDS).index)
    if not categories:
        return None

    searchable = f"{title_text} {company_text} {location_text} {description_text} {tags_text}"
    if not is_remote_india_compatible(location_text, searchable):
        return None

    parsed_date = parse_date(published_at)
    published = "" if parsed_date == datetime.min.replace(tzinfo=timezone.utc) else parsed_date.date().isoformat()

    return Job(
        title=title_text,
        company=company_text,
        location=location_text,
        url=url_text,
        source=source,
        published_at=published,
        categories=categories,
        summary=summarize(description_text),
    )


def fetch_remotive() -> list[Job]:
    jobs: list[Job] = []
    seen_queries: set[str] = set()

    for query in SEARCH_QUERIES:
        if query in seen_queries:
            continue
        seen_queries.add(query)
        encoded = urllib.parse.quote(query)
        data = request_json(f"https://remotive.com/api/remote-jobs?search={encoded}")
        for item in data.get("jobs", []) if isinstance(data, dict) else []:
            job = make_job(
                title=item.get("title"),
                company=item.get("company_name"),
                location=item.get("candidate_required_location"),
                url=item.get("url"),
                source="Remotive",
                published_at=item.get("publication_date"),
                description=item.get("description"),
                tags=" ".join(item.get("tags", [])) if isinstance(item.get("tags"), list) else item.get("tags", ""),
            )
            if job:
                jobs.append(job)

    return jobs


def fetch_remoteok() -> list[Job]:
    data = request_json("https://remoteok.com/api")
    if not isinstance(data, list):
        return []

    jobs: list[Job] = []
    for item in data:
        if not isinstance(item, dict) or not item.get("position"):
            continue
        tags = item.get("tags", [])
        job = make_job(
            title=item.get("position"),
            company=item.get("company"),
            location=item.get("location") or "Remote",
            url=item.get("apply_url") or item.get("url"),
            source="Remote OK",
            published_at=item.get("date"),
            description=item.get("description"),
            tags=" ".join(tags) if isinstance(tags, list) else tags,
        )
        if job:
            jobs.append(job)

    return jobs


def fetch_arbeitnow() -> list[Job]:
    data = request_json("https://www.arbeitnow.com/api/job-board-api")
    if not isinstance(data, dict):
        return []

    jobs: list[Job] = []
    for item in data.get("data", []):
        if not isinstance(item, dict) or not item.get("remote"):
            continue
        tags = item.get("tags", [])
        job = make_job(
            title=item.get("title"),
            company=item.get("company_name"),
            location=item.get("location") or "Remote",
            url=item.get("url") or item.get("slug"),
            source="Arbeitnow",
            published_at=item.get("created_at"),
            description=item.get("description"),
            tags=" ".join(tags) if isinstance(tags, list) else tags,
        )
        if job:
            jobs.append(job)

    return jobs


def fetch_all_jobs() -> tuple[list[Job], list[str]]:
    all_jobs: list[Job] = []
    errors: list[str] = []

    for source_name, fetcher in [
        ("Remotive", fetch_remotive),
        ("Remote OK", fetch_remoteok),
        ("Arbeitnow", fetch_arbeitnow),
    ]:
        try:
            all_jobs.extend(fetcher())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            errors.append(f"{source_name}: {exc}")

    return deduplicate_jobs(all_jobs), errors


def deduplicate_jobs(jobs: Iterable[Job]) -> list[Job]:
    deduped: dict[str, Job] = {}

    for job in jobs:
        key_source = job.url or f"{job.title}-{job.company}"
        key = hashlib.sha256(key_source.casefold().encode("utf-8")).hexdigest()
        deduped.setdefault(key, job)

    return sorted(
        deduped.values(),
        key=lambda item: (parse_date(item.published_at), item.company.casefold(), item.title.casefold()),
        reverse=True,
    )[:MAX_RESULTS]


def category_counts(jobs: Iterable[Job]) -> dict[str, int]:
    counts = {category: 0 for category in ROLE_KEYWORDS}
    for job in jobs:
        for category in job.categories:
            counts[category] = counts.get(category, 0) + 1
    return {category: count for category, count in counts.items() if count}


def render_markdown(jobs: list[Job], generated_at: datetime, errors: list[str]) -> str:
    lines = [
        "# Daily remote finance jobs for India",
        "",
        f"Last updated: {generated_at.strftime('%Y-%m-%d %I:%M %p %Z')}",
        "",
        "This report lists worldwide or India-compatible work-from-home roles in finance, credit underwriting, risk analysis, accounts, taxation, and return-to-work opportunities.",
        "",
        f"Total matching postings: **{len(jobs)}**",
        "",
    ]

    counts = category_counts(jobs)
    if counts:
        lines.extend(["## Category counts", ""])
        for category, count in counts.items():
            lines.append(f"- {category}: {count}")
        lines.append("")

    if errors:
        lines.extend(["## Source warnings", ""])
        lines.extend(f"- {error}" for error in errors)
        lines.append("")

    lines.extend(["## Postings", ""])
    if not jobs:
        lines.append("No matching postings were found in the public feeds during this run.")
    else:
        for index, job in enumerate(jobs, start=1):
            category_text = ", ".join(job.categories)
            posted = job.published_at or "date not listed"
            lines.extend(
                [
                    f"### {index}. [{job.title}]({job.url})",
                    "",
                    f"- Company: {job.company}",
                    f"- Location: {job.location}",
                    f"- Source: {job.source}",
                    f"- Posted: {posted}",
                    f"- Matches: {category_text}",
                    "",
                    job.summary or "No summary available.",
                    "",
                ]
            )

    lines.extend(
        [
            "## Sources and filter logic",
            "",
            "- Sources: Remotive, Remote OK, and Arbeitnow public job feeds.",
            "- Schedule: every day at 1:00 PM IST.",
            "- Location filter: keeps roles marked as India, worldwide, anywhere, global, Asia/APAC, or generally remote without an explicit non-India-only restriction.",
            "- Keyword filter: title-focused finance, credit underwriting, risk analysis, accounts/accounting, taxation/tax, and return-to-work terms.",
            "",
        ]
    )
    return "\n".join(lines)


def render_html(jobs: list[Job], generated_at: datetime, errors: list[str]) -> str:
    cards = []
    for job in jobs:
        cards.append(
            f"""
            <article class="job-card">
              <h2><a href="{html.escape(job.url)}">{html.escape(job.title)}</a></h2>
              <p class="meta">{html.escape(job.company)} · {html.escape(job.location)} · {html.escape(job.source)}</p>
              <p>{html.escape(job.summary or "No summary available.")}</p>
              <p class="tags">{html.escape(", ".join(job.categories))}</p>
              <p class="posted">Posted: {html.escape(job.published_at or "date not listed")}</p>
            </article>
            """
        )

    counts = category_counts(jobs)
    count_markup = "\n".join(
        f"<li><strong>{html.escape(category)}</strong>: {count}</li>"
        for category, count in counts.items()
    )
    warning_markup = "\n".join(
        f"<li>{html.escape(error)}</li>"
        for error in errors
    )

    empty_message = ""
    if not cards:
        empty_message = "<p>No matching postings were found in the public feeds during this run.</p>"

    return textwrap.dedent(
        f"""\
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Daily remote finance jobs for India</title>
          <style>
            :root {{
              color-scheme: light;
              --bg: #f6f7fb;
              --card: #ffffff;
              --text: #1f2937;
              --muted: #5b6575;
              --accent: #2557a7;
              --border: #d9e0ec;
            }}
            body {{
              margin: 0;
              background: var(--bg);
              color: var(--text);
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              line-height: 1.5;
            }}
            main {{
              max-width: 980px;
              margin: 0 auto;
              padding: 32px 18px 56px;
            }}
            header {{
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 18px;
              padding: 28px;
              box-shadow: 0 12px 34px rgba(31, 41, 55, 0.08);
            }}
            h1 {{
              margin: 0 0 10px;
              font-size: clamp(2rem, 5vw, 3rem);
            }}
            a {{
              color: var(--accent);
            }}
            .summary-grid {{
              display: grid;
              gap: 14px;
              grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
              margin: 24px 0;
            }}
            .summary-box, .job-card {{
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 16px;
              padding: 20px;
            }}
            .job-card {{
              margin: 16px 0;
            }}
            .job-card h2 {{
              margin-top: 0;
            }}
            .meta, .posted {{
              color: var(--muted);
            }}
            .tags {{
              display: inline-block;
              border-radius: 999px;
              background: #eaf1ff;
              color: #163c78;
              padding: 6px 10px;
              font-size: 0.9rem;
            }}
            .warnings {{
              border-left: 4px solid #d97706;
              background: #fff7ed;
              padding: 12px 16px;
            }}
          </style>
        </head>
        <body>
          <main>
            <header>
              <h1>Daily remote finance jobs for India</h1>
              <p>Worldwide or India-compatible work-from-home roles in finance, credit underwriting, risk analysis, accounts, taxation, and return-to-work opportunities.</p>
              <p><strong>Last updated:</strong> {html.escape(generated_at.strftime('%Y-%m-%d %I:%M %p %Z'))}</p>
            </header>

            <section class="summary-grid" aria-label="Summary">
              <div class="summary-box">
                <h2>{len(jobs)}</h2>
                <p>matching postings</p>
              </div>
              <div class="summary-box">
                <h2>1:00 PM IST</h2>
                <p>daily refresh schedule</p>
              </div>
            </section>

            <section>
              <h2>Category counts</h2>
              <ul>{count_markup}</ul>
            </section>

            {"<section class='warnings'><h2>Source warnings</h2><ul>" + warning_markup + "</ul></section>" if warning_markup else ""}

            <section>
              <h2>Postings</h2>
              {empty_message}
              {"".join(cards)}
            </section>

            <section>
              <h2>Sources and filters</h2>
              <ul>
                <li>Sources: Remotive, Remote OK, and Arbeitnow public job feeds.</li>
                <li>Location filter: India, worldwide, anywhere, global, Asia/APAC, or remote without an explicit non-India-only restriction.</li>
                <li>Keyword filter: title-focused finance, credit underwriting, risk analysis, accounts/accounting, taxation/tax, and return-to-work terms.</li>
              </ul>
            </section>
          </main>
        </body>
        </html>
        """
    )


def write_outputs(jobs: list[Job], generated_at: datetime, errors: list[str]) -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    (DOCS_DIR / "index.html").write_text(render_html(jobs, generated_at, errors), encoding="utf-8")
    (DOCS_DIR / "job-postings.md").write_text(render_markdown(jobs, generated_at, errors), encoding="utf-8")
    (DOCS_DIR / "jobs.json").write_text(
        json.dumps(
            {
                "generated_at": generated_at.isoformat(),
                "total": len(jobs),
                "jobs": [asdict(job) for job in jobs],
                "errors": errors,
            },
            indent=2,
            ensure_ascii=True,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-results",
        type=int,
        default=MAX_RESULTS,
        help="Maximum postings to publish after filtering.",
    )
    args = parser.parse_args()

    jobs, errors = fetch_all_jobs()
    limited_jobs = jobs[: max(0, args.max_results)]
    generated_at = datetime.now(IST)
    write_outputs(limited_jobs, generated_at, errors)

    print(f"Published {len(limited_jobs)} matching job postings to {DOCS_DIR}")
    if errors:
        print("Source warnings:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
