"""Command line entry point for the job sponsorship scanner."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .models import JobPosting
from .profile import load_profile
from .report import render_report
from .scoring import curate_jobs
from .sources import fetch_jobs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Create a curated daily list of jobs matching a profile and visa constraints."
    )
    parser.add_argument(
        "--profile",
        help="Path to profile JSON. Defaults to config/profile.json, then the example config.",
    )
    parser.add_argument(
        "--output",
        help="Write the Markdown report to this path. Prints to stdout when omitted.",
    )
    parser.add_argument(
        "--input-json",
        help="Read normalized job postings from JSON instead of live APIs. Useful for tests/dry runs.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="HTTP timeout per source request in seconds.",
    )
    args = parser.parse_args(argv)

    loaded_profile = load_profile(args.profile)
    profile = loaded_profile.profile

    if args.input_json:
        postings = _load_postings(Path(args.input_json))
    else:
        postings = fetch_jobs(profile.search_terms, timeout_seconds=args.timeout)

    matches = curate_jobs(profile, postings)
    report = render_report(loaded_profile, matches)
    _write_report(report, args.output)
    _append_step_summary(report)
    return 0


def _load_postings(path: Path) -> list[JobPosting]:
    with path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    if not isinstance(raw, list):
        raise ValueError(f"Input postings must be a JSON array: {path}")

    postings: list[JobPosting] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        postings.append(
            JobPosting(
                source=str(item.get("source", "local")),
                title=str(item.get("title", "")),
                company=str(item.get("company", "")),
                url=str(item.get("url", "")),
                location=str(item.get("location", "")),
                description=str(item.get("description", "")),
                tags=tuple(str(tag) for tag in item.get("tags", ())),
                published_at=str(item.get("published_at", "")),
            )
        )
    return postings


def _write_report(report: str, output_path: str | None) -> None:
    if not output_path:
        print(report)
        return

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(report, encoding="utf-8")


def _append_step_summary(report: str) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write(report)
        handle.write("\n")


if __name__ == "__main__":
    sys.exit(main())
