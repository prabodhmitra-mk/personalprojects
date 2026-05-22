"""Shared data models for the job scanning agent."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class JobPosting:
    """A normalized job posting from any supported source."""

    source: str
    title: str
    company: str
    url: str
    location: str = ""
    description: str = ""
    tags: tuple[str, ...] = field(default_factory=tuple)
    published_at: str = ""

    @property
    def searchable_text(self) -> str:
        return " ".join(
            part
            for part in (
                self.title,
                self.company,
                self.location,
                " ".join(self.tags),
                self.description,
            )
            if part
        ).lower()


@dataclass(frozen=True)
class ScoredJob:
    """A posting plus the score and reasons used in the daily curation."""

    posting: JobPosting
    score: int
    reasons: tuple[str, ...]
    sponsorship_signal: bool
    location_signal: bool
