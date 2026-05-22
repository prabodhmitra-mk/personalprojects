"""Markdown reporting for daily curated matches."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from .models import ScoredJob
from .profile import LoadedProfile


IST = ZoneInfo("Asia/Kolkata")


def render_report(
    loaded_profile: LoadedProfile,
    matches: list[ScoredJob],
    generated_at: datetime | None = None,
) -> str:
    """Render the curated job list as Markdown."""

    now = generated_at or datetime.now(tz=IST)
    profile = loaded_profile.profile
    lines = [
        f"# Daily sponsored job matches - {now.strftime('%Y-%m-%d')}",
        "",
        f"Generated for **{_escape(profile.name)}** at {now.strftime('%I:%M %p IST')}.",
        "",
    ]

    if loaded_profile.is_example:
        lines.extend(
            [
                "> Warning: using `config/profile.example.json`. Copy it to "
                "`config/profile.json` or set `JOB_AGENT_PROFILE_JSON` with your real "
                "title, skills, and location preferences.",
                "",
            ]
        )

    lines.extend(
        [
            "## Matching rules",
            "",
            "- Includes postings with a visa/relocation sponsorship signal, or remote/global/India eligibility.",
            "- Excludes postings that explicitly say sponsorship is unavailable or non-India work authorization is required.",
            "- Scores combine title, skills, sponsorship, and location signals.",
            "",
        ]
    )

    if not matches:
        lines.extend(
            [
                "## Curated matches",
                "",
                "No strong matches found in this run. Try broadening target titles, adding more skills, or lowering `minimum_score`.",
                "",
            ]
        )
        return "\n".join(lines)

    lines.extend(
        [
            "## Curated matches",
            "",
            "| Score | Role | Company | Source | Location | Visa/location fit | Why it matched |",
            "| ---: | --- | --- | --- | --- | --- | --- |",
        ]
    )

    for match in matches:
        posting = match.posting
        fit = []
        if match.sponsorship_signal:
            fit.append("sponsorship")
        if match.location_signal:
            fit.append("remote/global/India")
        lines.append(
            "| {score} | [{title}]({url}) | {company} | {source} | {location} | {fit} | {reasons} |".format(
                score=match.score,
                title=_escape(posting.title),
                url=posting.url,
                company=_escape(posting.company or "Unknown"),
                source=_escape(posting.source),
                location=_escape(posting.location or "Not listed"),
                fit=_escape(", ".join(fit) or "needs review"),
                reasons=_escape("; ".join(match.reasons)),
            )
        )

    lines.extend(
        [
            "",
            "## Review checklist",
            "",
            "- Confirm the employer's latest visa policy before applying.",
            "- Prioritize rows with `sponsorship` in the fit column for non-India onsite roles.",
            "- Treat `remote/global/India` as acceptable when the role can legally be performed from India.",
            "",
        ]
    )
    return "\n".join(lines)


def _escape(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ").strip()
