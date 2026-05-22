"""Candidate profile configuration."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


DEFAULT_PROFILE_PATH = Path("config/profile.json")
EXAMPLE_PROFILE_PATH = Path("config/profile.example.json")


@dataclass(frozen=True)
class CandidateProfile:
    """Inputs used to match postings to a candidate."""

    name: str = "Candidate"
    target_titles: tuple[str, ...] = field(default_factory=tuple)
    skills: tuple[str, ...] = field(default_factory=tuple)
    preferred_locations: tuple[str, ...] = ("india", "remote", "worldwide")
    work_permission_countries: tuple[str, ...] = ("india",)
    visa_keywords: tuple[str, ...] = (
        "visa sponsorship",
        "sponsorship available",
        "sponsor visa",
        "work visa",
        "skilled worker visa",
        "h-1b",
        "h1b",
        "relocation assistance",
        "relocation support",
        "global talent visa",
        "permit sponsorship",
    )
    remote_global_keywords: tuple[str, ...] = (
        "worldwide",
        "anywhere",
        "global",
        "remote",
        "india",
        "asia",
        "apac",
        "emea",
    )
    exclude_keywords: tuple[str, ...] = (
        "no visa sponsorship",
        "visa sponsorship is not available",
        "unable to sponsor",
        "cannot sponsor",
        "must already be authorized to work in the united states",
        "must be authorized to work in the united states",
        "us work authorization required",
        "eu work authorization required",
        "uk work authorization required",
        "citizenship required",
        "security clearance",
    )
    max_results: int = 15
    minimum_score: int = 35
    require_sponsorship_or_global_remote: bool = True

    @classmethod
    def from_mapping(cls, data: dict[str, Any]) -> "CandidateProfile":
        return cls(
            name=str(data.get("name", cls.name)),
            target_titles=_to_tuple(data.get("target_titles", ())),
            skills=_to_tuple(data.get("skills", ())),
            preferred_locations=_to_tuple(
                data.get("preferred_locations", cls.preferred_locations)
            ),
            work_permission_countries=_to_tuple(
                data.get("work_permission_countries", cls.work_permission_countries)
            ),
            visa_keywords=_to_tuple(data.get("visa_keywords", cls.visa_keywords)),
            remote_global_keywords=_to_tuple(
                data.get("remote_global_keywords", cls.remote_global_keywords)
            ),
            exclude_keywords=_to_tuple(
                data.get("exclude_keywords", cls.exclude_keywords)
            ),
            max_results=int(data.get("max_results", cls.max_results)),
            minimum_score=int(data.get("minimum_score", cls.minimum_score)),
            require_sponsorship_or_global_remote=bool(
                data.get(
                    "require_sponsorship_or_global_remote",
                    cls.require_sponsorship_or_global_remote,
                )
            ),
        )

    @property
    def search_terms(self) -> tuple[str, ...]:
        terms = [*self.target_titles, *self.skills]
        normalized: list[str] = []
        for term in terms:
            clean = term.strip()
            if clean and clean.lower() not in {item.lower() for item in normalized}:
                normalized.append(clean)
        return tuple(normalized[:8] or ("software engineer",))


@dataclass(frozen=True)
class LoadedProfile:
    profile: CandidateProfile
    path: Path | None
    is_example: bool


def load_profile(path: str | Path | None = None) -> LoadedProfile:
    """Load a candidate profile from disk or JOB_AGENT_PROFILE_JSON."""

    raw_json = os.environ.get("JOB_AGENT_PROFILE_JSON")
    if raw_json:
        return LoadedProfile(
            profile=CandidateProfile.from_mapping(json.loads(raw_json)),
            path=None,
            is_example=False,
        )

    requested = Path(path) if path else DEFAULT_PROFILE_PATH
    if requested.exists():
        return LoadedProfile(
            profile=CandidateProfile.from_mapping(_read_json(requested)),
            path=requested,
            is_example=False,
        )

    if path:
        raise FileNotFoundError(f"Profile config not found: {requested}")

    if EXAMPLE_PROFILE_PATH.exists():
        return LoadedProfile(
            profile=CandidateProfile.from_mapping(_read_json(EXAMPLE_PROFILE_PATH)),
            path=EXAMPLE_PROFILE_PATH,
            is_example=True,
        )

    return LoadedProfile(profile=CandidateProfile(), path=None, is_example=True)


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Profile config must be a JSON object: {path}")
    return data


def _to_tuple(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,)
    return tuple(str(item) for item in value if str(item).strip())
