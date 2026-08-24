# Changelog

All notable changes to NFLDrafter are documented here.

## [Unreleased]

## [2026-08-24]

### Added

- Persistent read-only Yahoo league snapshots covering metadata, settings, teams, standings, rosters, draft results, transactions, scoreboard, available players, ownership, draft analysis, stat categories, and completed-season player statistics.
- A single Refresh all sources workflow that refreshes public providers and the selected Yahoo league independently, persists results, and reports provider-level failures.
- 2025 Yahoo season statistics for up to 300 relevant players, named with Yahoo's stat-category metadata.
- Yahoo market context and cached season statistics in player decision data.
- League-aware likely-round and pick-within-round estimates below ADP.
- Current Draft Room and player-detail documentation screenshots.

### Changed

- Redesigned the Draft Room around the clock, best available players, roster status, and modal secondary workflows.
- Made external data database-first and disabled scheduled website refreshes unless explicitly enabled.
- Expanded Yahoo settings parsing to support the live nested scoring-modifier XML format while retaining unsupported rules for review.
- Persisted the selected Yahoo league across modal sessions and page reloads.

### Fixed

- Yahoo OAuth readiness, callback, token verification, and automatic refresh behavior.
- Refresh isolation so a failing public provider does not prevent the Yahoo snapshot from updating.
- Current-season preseason zeros no longer replace the useful completed-season Yahoo baseline.
