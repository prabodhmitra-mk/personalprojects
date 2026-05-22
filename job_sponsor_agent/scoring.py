"""Match and rank jobs against the candidate profile."""

from __future__ import annotations

from collections.abc import Iterable

from .models import JobPosting, ScoredJob
from .profile import CandidateProfile


def curate_jobs(profile: CandidateProfile, postings: Iterable[JobPosting]) -> list[ScoredJob]:
    """Score, filter, and sort postings for the daily report."""

    scored = [
        scored
        for posting in postings
        if (scored := score_posting(profile, posting)) is not None
    ]
    scored.sort(key=lambda item: (-item.score, item.posting.published_at, item.posting.company))
    return scored[: profile.max_results]


def score_posting(profile: CandidateProfile, posting: JobPosting) -> ScoredJob | None:
    text = posting.searchable_text

    excluded = _matched_terms(text, profile.exclude_keywords)
    if excluded:
        return None

    title_matches = _matched_terms(posting.title.lower(), profile.target_titles)
    skill_matches = _matched_terms(text, profile.skills)
    sponsorship_matches = _matched_terms(text, profile.visa_keywords)
    location_matches = _matched_terms(
        " ".join((posting.location, posting.title, " ".join(posting.tags))).lower(),
        (*profile.remote_global_keywords, *profile.work_permission_countries),
    )
    preferred_location_matches = _matched_terms(text, profile.preferred_locations)

    sponsorship_signal = bool(sponsorship_matches)
    location_signal = bool(location_matches or preferred_location_matches)

    if profile.require_sponsorship_or_global_remote and not (
        sponsorship_signal or location_signal
    ):
        return None

    score = 0
    reasons: list[str] = []

    if title_matches:
        score += min(40, 20 + 10 * len(title_matches))
        reasons.append(f"title match: {', '.join(title_matches[:3])}")
    if skill_matches:
        score += min(45, 8 * len(skill_matches))
        reasons.append(f"skill match: {', '.join(skill_matches[:5])}")
    if sponsorship_matches:
        score += 35
        reasons.append(f"sponsorship signal: {', '.join(sponsorship_matches[:3])}")
    if location_matches:
        score += 25
        reasons.append(f"remote/global/India signal: {', '.join(location_matches[:3])}")
    elif preferred_location_matches:
        score += 15
        reasons.append(
            f"preferred location signal: {', '.join(preferred_location_matches[:3])}"
        )

    if not reasons or score < profile.minimum_score:
        return None

    return ScoredJob(
        posting=posting,
        score=score,
        reasons=tuple(reasons),
        sponsorship_signal=sponsorship_signal,
        location_signal=location_signal,
    )


def _matched_terms(text: str, terms: Iterable[str]) -> list[str]:
    matches: list[str] = []
    normalized_text = f" {text.lower()} "
    for term in terms:
        normalized = term.strip().lower()
        if not normalized:
            continue
        if normalized in normalized_text and normalized not in {
            item.lower() for item in matches
        }:
            matches.append(term)
    return matches
