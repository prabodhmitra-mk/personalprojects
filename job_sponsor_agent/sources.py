"""Job board API adapters."""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from collections.abc import Iterable
from html import unescape
from typing import Any

from .models import JobPosting


USER_AGENT = "personal-job-sponsor-agent/0.1 (+https://github.com)"
HTML_TAG_RE = re.compile(r"<[^>]+>")


def fetch_jobs(search_terms: Iterable[str], timeout_seconds: int = 20) -> list[JobPosting]:
    """Fetch postings from public job board APIs."""

    postings: list[JobPosting] = []
    for term in search_terms:
        postings.extend(_fetch_remotive(term, timeout_seconds))
        postings.extend(_fetch_remoteok(term, timeout_seconds))
    postings.extend(_fetch_arbeitnow(timeout_seconds))
    return _dedupe(postings)


def _fetch_remotive(term: str, timeout_seconds: int) -> list[JobPosting]:
    params = urllib.parse.urlencode({"search": term, "limit": 100})
    url = f"https://remotive.com/api/remote-jobs?{params}"
    data = _get_json(url, timeout_seconds)
    jobs = data.get("jobs", []) if isinstance(data, dict) else []

    postings: list[JobPosting] = []
    for item in jobs:
        if not isinstance(item, dict):
            continue
        postings.append(
            JobPosting(
                source="Remotive",
                title=_clean(item.get("title")),
                company=_clean(item.get("company_name")),
                url=_clean(item.get("url")),
                location=_clean(item.get("candidate_required_location")),
                description=_strip_html(_clean(item.get("description"))),
                tags=tuple(_clean(tag) for tag in item.get("tags", []) if tag),
                published_at=_clean(item.get("publication_date")),
            )
        )
    return [posting for posting in postings if posting.title and posting.url]


def _fetch_remoteok(term: str, timeout_seconds: int) -> list[JobPosting]:
    params = urllib.parse.urlencode({"tags": term})
    url = f"https://remoteok.com/api?{params}"
    data = _get_json(url, timeout_seconds)
    jobs = data[1:] if isinstance(data, list) else []

    postings: list[JobPosting] = []
    for item in jobs:
        if not isinstance(item, dict):
            continue
        postings.append(
            JobPosting(
                source="Remote OK",
                title=_clean(item.get("position")),
                company=_clean(item.get("company")),
                url=_clean(item.get("url")) or _clean(item.get("apply_url")),
                location=_clean(item.get("location")),
                description=_strip_html(_clean(item.get("description"))),
                tags=tuple(_clean(tag) for tag in item.get("tags", []) if tag),
                published_at=_clean(item.get("date")),
            )
        )
    return [posting for posting in postings if posting.title and posting.url]


def _fetch_arbeitnow(timeout_seconds: int) -> list[JobPosting]:
    url = "https://www.arbeitnow.com/api/job-board-api"
    data = _get_json(url, timeout_seconds)
    jobs = data.get("data", []) if isinstance(data, dict) else []

    postings: list[JobPosting] = []
    for item in jobs:
        if not isinstance(item, dict):
            continue
        tags = item.get("tags") or []
        postings.append(
            JobPosting(
                source="Arbeitnow",
                title=_clean(item.get("title")),
                company=_clean(item.get("company_name")),
                url=_clean(item.get("url")),
                location=_clean(item.get("location")),
                description=_strip_html(_clean(item.get("description"))),
                tags=tuple(_clean(tag) for tag in tags if tag),
                published_at=_clean(item.get("created_at")),
            )
        )
    return [posting for posting in postings if posting.title and posting.url]


def _get_json(url: str, timeout_seconds: int) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - source failures should not stop the run.
        print(f"Warning: failed to fetch {url}: {exc}", file=sys.stderr)
        return {}


def _dedupe(postings: Iterable[JobPosting]) -> list[JobPosting]:
    unique: dict[str, JobPosting] = {}
    for posting in postings:
        key = posting.url.lower() or f"{posting.company.lower()}:{posting.title.lower()}"
        unique.setdefault(key, posting)
    return list(unique.values())


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return unescape(str(value)).strip()


def _strip_html(value: str) -> str:
    return re.sub(r"\s+", " ", HTML_TAG_RE.sub(" ", value)).strip()
