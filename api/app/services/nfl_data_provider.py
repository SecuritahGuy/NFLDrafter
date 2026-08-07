"""Provider boundary for external NFL data.

Keeping nflreadpy behind this small interface lets tests and CSV imports provide
the same records without network access or Polars leaking into the application.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol

PlayerRecord = dict[str, Any]
WeeklyStatRecord = dict[str, Any]
RankingRecord = dict[str, Any]
InjuryRecord = dict[str, Any]


class NFLDataProvider(Protocol):
    def load_players(self, season: int | None = None) -> list[PlayerRecord]: ...

    def load_weekly_stats(self, seasons: Sequence[int]) -> list[WeeklyStatRecord]: ...

    def load_rankings(
        self, rank_type: str = "preseason"
    ) -> list[RankingRecord]: ...

    def load_injuries(
        self, seasons: Sequence[int] | None = None
    ) -> list[InjuryRecord]: ...


@dataclass(slots=True)
class NFLReadPyProvider:
    """nflverse provider backed by the maintained nflreadpy package."""

    def _records(self, frame: Any) -> list[dict[str, Any]]:
        return frame.to_dicts()

    def load_players(self, season: int | None = None) -> list[PlayerRecord]:
        import nflreadpy as nfl

        # Player identities are mostly immutable; season is accepted to keep the
        # provider interchangeable with season-specific CSV sources.
        del season
        return self._records(nfl.load_players())

    def load_weekly_stats(self, seasons: Sequence[int]) -> list[WeeklyStatRecord]:
        import nflreadpy as nfl

        return self._records(nfl.load_player_stats(list(seasons), summary_level="week"))

    def load_rankings(self, rank_type: str = "preseason") -> list[RankingRecord]:
        import nflreadpy as nfl

        # nflreadpy maps: "draft" (preseason ECR), "week" (in-season weekly), "all" (history).
        return self._records(nfl.load_ff_rankings(type="draft" if rank_type == "preseason" else "week"))

    def load_injuries(
        self, seasons: Sequence[int] | None = None
    ) -> list[InjuryRecord]:
        import nflreadpy as nfl

        if seasons:
            return self._records(nfl.load_injuries(seasons=list(seasons)))
        return self._records(nfl.load_injuries())


def get_nfl_data_provider() -> NFLDataProvider:
    return NFLReadPyProvider()
