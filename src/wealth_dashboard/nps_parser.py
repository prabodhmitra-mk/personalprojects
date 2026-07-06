from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

from wealth_dashboard.models import Holding, NpsStatement

NUMBER_PATTERN = re.compile(r"-?\(?\d[\d,]*(?:\.\d+)?\)?")
DATE_PATTERNS = [
    re.compile(
        r"(?:as\s+(?:on|of)|statement\s+date|valuation\s+date)\s*[:\-]?\s*"
        r"(?P<date>\d{1,2}[-/ ](?:[A-Za-z]{3,9}|\d{1,2})[-/ ]\d{2,4})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:as\s+(?:on|of)|statement\s+date|valuation\s+date)\s*[:\-]?\s*"
        r"(?P<date>\d{4}[-/]\d{1,2}[-/]\d{1,2})",
        re.IGNORECASE,
    ),
]
NAME_PATTERN = re.compile(
    r"(?:subscriber|name\s+of\s+subscriber|subscriber\s+name)\s*[:\-]\s*(?P<name>[A-Z][A-Za-z .'-]+)",
    re.IGNORECASE,
)
PRAN_PATTERN = re.compile(r"\bPRAN\b\s*[:\-]?\s*(?P<pran>\d{8,16})", re.IGNORECASE)
TOTAL_PATTERNS = [
    re.compile(
        r"(?:total\s+(?:corpus|holding|wealth|value|current\s+value)|current\s+corpus)\s*[:\-]?\s*"
        r"(?:Rs\.?|INR|\u20b9)?\s*(?P<value>\d[\d,]*(?:\.\d+)?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:Rs\.?|INR|\u20b9)?\s*(?P<value>\d[\d,]*(?:\.\d+)?)\s*"
        r"(?:total\s+(?:corpus|holding|wealth|value|current\s+value)|current\s+corpus)",
        re.IGNORECASE,
    ),
]
ASSET_CLASS_PATTERN = re.compile(
    r"\b(?:scheme\s*)?(?P<asset_class>[AECG](?:\s*-\s*(?:Tier\s*)?I)?)\b",
    re.IGNORECASE,
)

HOLDING_HINTS = (
    "scheme",
    "pension",
    "fund",
    "tier",
    "asset class",
)
NON_HOLDING_HINTS = (
    "contribution",
    "withdrawal",
    "redemption",
    "switch",
    "transaction",
    "opening balance",
    "closing balance",
    "total",
    "subtotal",
    "date",
    "employee",
    "employer",
    "charges",
    "tax",
    "gst",
)


def parse_nps_statement_text(text: str, source_file: Path | None = None) -> NpsStatement:
    """Parse extracted NPS Tier 1 statement text into dashboard-friendly values."""

    cleaned_text = _normalise_text(text)
    holdings = _parse_holdings(cleaned_text)
    total_value = _parse_total_value(cleaned_text)

    if total_value is None and holdings:
        total_value = sum(holding.market_value for holding in holdings)

    return NpsStatement(
        holdings=holdings,
        total_value=total_value,
        as_of_date=_parse_as_of_date(cleaned_text),
        subscriber_name=_parse_subscriber_name(cleaned_text),
        pran=_parse_pran(cleaned_text),
        source_file=source_file,
    )


def _normalise_text(text: str) -> str:
    return (
        text.replace("\u00a0", " ")
        .replace("\u20b9", "Rs. ")
        .replace("\r", "\n")
    )


def _parse_holdings(text: str) -> list[Holding]:
    holdings: list[Holding] = []
    seen: set[tuple[str, float, float, float]] = set()

    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue

        holding = _parse_holding_line(line)
        if holding is None:
            continue

        key = (
            holding.scheme_name.lower(),
            round(holding.units, 6),
            round(holding.nav, 6),
            round(holding.market_value, 2),
        )
        if key not in seen:
            holdings.append(holding)
            seen.add(key)

    return holdings


def _parse_holding_line(line: str) -> Holding | None:
    matches = list(NUMBER_PATTERN.finditer(line))
    if len(matches) < 3:
        return None

    numeric_matches = matches[-3:]
    name = line[: numeric_matches[0].start()].strip(" :-|")
    if not _looks_like_holding_name(name):
        return None

    try:
        units = _parse_number(numeric_matches[0].group())
        nav = _parse_number(numeric_matches[1].group())
        value = _parse_number(numeric_matches[2].group())
    except ValueError:
        return None

    if units <= 0 or nav <= 0 or value <= 0:
        return None

    # NPS statements usually report market value as units * NAV. This tolerance
    # filters many transaction rows without rejecting rounded statement values.
    calculated_value = units * nav
    tolerance = max(5.0, value * 0.05)
    if abs(calculated_value - value) > tolerance:
        return None

    return Holding(
        scheme_name=_clean_scheme_name(name),
        units=units,
        nav=nav,
        market_value=value,
        asset_class=_parse_asset_class(name),
    )


def _looks_like_holding_name(name: str) -> bool:
    if not name:
        return False

    lowered = name.lower()
    if any(hint in lowered for hint in NON_HOLDING_HINTS):
        return False

    if any(hint in lowered for hint in HOLDING_HINTS):
        return True

    return bool(ASSET_CLASS_PATTERN.search(name)) and len(name) > 1


def _parse_number(value: str) -> float:
    cleaned = value.strip().replace(",", "")
    negative = cleaned.startswith("(") and cleaned.endswith(")")
    cleaned = cleaned.strip("()")
    parsed = float(cleaned)
    return -parsed if negative else parsed


def _clean_scheme_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip(" :-|")
    return name or "NPS Holding"


def _parse_asset_class(name: str) -> str | None:
    match = ASSET_CLASS_PATTERN.search(name)
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group("asset_class").upper()).replace(" ", "")


def _parse_total_value(text: str) -> float | None:
    for pattern in TOTAL_PATTERNS:
        for match in pattern.finditer(text):
            try:
                return _parse_number(match.group("value"))
            except ValueError:
                continue
    return None


def _parse_as_of_date(text: str) -> date | None:
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        parsed = _parse_date(match.group("date"))
        if parsed is not None:
            return parsed
    return None


def _parse_date(value: str) -> date | None:
    normalised = value.replace("/", "-").replace(" ", "-")
    formats = (
        "%d-%m-%Y",
        "%d-%m-%y",
        "%d-%b-%Y",
        "%d-%b-%y",
        "%d-%B-%Y",
        "%d-%B-%y",
        "%Y-%m-%d",
    )
    for fmt in formats:
        try:
            return datetime.strptime(normalised, fmt).date()
        except ValueError:
            continue
    return None


def _parse_subscriber_name(text: str) -> str | None:
    match = NAME_PATTERN.search(text)
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group("name")).strip()


def _parse_pran(text: str) -> str | None:
    match = PRAN_PATTERN.search(text)
    if not match:
        return None
    return match.group("pran")

