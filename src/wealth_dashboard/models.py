from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class Holding:
    """A single current holding row from an NPS statement."""

    scheme_name: str
    units: float
    nav: float
    market_value: float
    asset_class: str | None = None

    @property
    def calculated_value(self) -> float:
        return self.units * self.nav


@dataclass(frozen=True)
class NpsStatement:
    """Parsed summary of an NPS Tier 1 statement."""

    holdings: list[Holding] = field(default_factory=list)
    total_value: float | None = None
    as_of_date: date | None = None
    subscriber_name: str | None = None
    pran: str | None = None
    source_file: Path | None = None

    @property
    def dashboard_total(self) -> float:
        if self.total_value is not None:
            return self.total_value
        return sum(holding.market_value for holding in self.holdings)

