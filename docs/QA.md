# Browser QA Evidence

This record captures the August and September 2026 manual browser reviews used to validate the revived Draft Room, Player Explorer, and post-draft Weekly Prep workspace. The images in `docs/images` are application screenshots from those QA runs and can be reused in the README and GitHub Pages site.

## Coverage

| Scenario | Result | Evidence |
| --- | --- | --- |
| Draft Room loads its persisted manual session and source-aware board | Pass | [Current Draft Room](images/nfldrafter-draft-room-2026.png) |
| ADP shows a likely round and pick within that round using the active league size | Pass | [Current Draft Room](images/nfldrafter-draft-room-2026.png) plus focused round-estimation tests |
| Manual tracker assigns snake-order ownership, removes drafted players from the board, records the full ledger, and restores players on undo | Pass | [Manual tracker](images/manual-draft-tracker.png) |
| Draft confidence exposes source agreement, FantasyPros expert range, FFC ADP variation, and directional next-pick availability | Pass | [Draft confidence](images/nfldrafter-draft-confidence.png) |
| Player detail charts dated FantasyPros, ESPN, and FFC rank history, labels feed freshness, and preserves gaps for unmatched dates | Pass | [Ranking movement](images/nfldrafter-ranking-movement.png) |
| Fantasy player universe exposes 1,002 players across QB, RB, WR, TE, K, and 32 D/ST units | Pass | [Player Explorer](images/nfldrafter-player-explorer-live.png) |
| Search and position filters expose quarterbacks and defenses that were previously absent | Pass | [Draft Room](images/nfldrafter-draft-room-live.jpg) |
| Selecting a player in the Draft Room opens the shared detail experience | Pass | [Current player detail](images/nfldrafter-player-detail-2026.png) |
| Selecting a player in the Player Explorer opens the same detailed profile | Pass | [Player detail](images/nfldrafter-player-detail.png) |
| Detail includes last-season totals and position-specific advanced usage | Pass | [Analytics](images/nfldrafter-player-detail-analytics.jpg) |
| Historical opportunity shows nflverse snap, target, and rushing shares plus actual PPR versus expected opportunity | Pass | [Historical opportunity](images/nfldrafter-historical-opportunity.png) |
| ESPN season and weekly projections include projected stat lines and ownership context | Pass | [Projection breakdown](images/nfldrafter-player-projection-breakdown.jpg) |
| Player detail derives a team-role estimate and available target/carry/yard shares from ranked teammate projections, with coverage caveats | Pass | [Projected team role](images/nfldrafter-projected-team-role.png) |
| Official FantasyPros projection samples load through the seven-day SQLite cache, match 60/60 players, and receive explicit provider attribution | Pass | [FantasyPros projections](images/nfldrafter-fantasypros-projections.png) |
| Schedule strength, official injury reports, and linked headlines render together | Pass | [Player context](images/nfldrafter-player-detail-context.jpg) |
| Custom scoring profile builder remains usable after the navigation redesign | Pass | [Scoring builder](images/nfldrafter-scoring-builder.png) |
| Selecting PPR re-scores ESPN season and weekly stat lines in the shared player drawer | Pass | [Profile-scored detail](images/nfldrafter-profile-scored-projections.png) |
| Draft Room renders league-aware position tiers and VORP without grouping unprojected players into fake tiers | Pass | [Projection analytics panel](images/nfldrafter-projection-analytics-panel.png) |
| Yahoo card confirms server credential readiness without exposing the client ID or secret | Pass | [Yahoo OAuth readiness](images/nfldrafter-yahoo-readiness.jpg) |
| Yahoo authorization returns through the configured callback and the Draft Room renders the connected state | Pass | [Yahoo OAuth readiness](images/nfldrafter-yahoo-readiness.jpg) plus the August 7 live sign-in rehearsal |
| Credentialed Yahoo league import against live Fantasy Sports data | Pass | Live 2026 league snapshot: 57 successful read requests, zero failures, 300 available players, 262 players with non-zero 2025 stats, 108 stat categories, 12 teams, 20 transactions, and 6 scheduled matchups |
| Yahoo fixture rehearsal previews teams, rosters, slots, and scoring rules, then reports match coverage | Pass | Frontend component tests plus backend XML/scoring/player-matching tests |
| Yahoo settings preserve all live scoring modifiers and avoid guessing unsupported rules | Pass | 35 live modifiers parsed; 12 offensive rules mapped and 23 kicker/defense/special-case rules retained for review |
| Weekly Prep renders the current matchup, league comparison, lineup review, waiver watch, and source-health context entirely from the persisted Yahoo snapshot | Pass | Live September 2 review against the imported 12-team league |
| Yahoo roster fallback resolves all 180 rostered player identities and the available-player cache resolves 455 of 480 candidates | Pass | Live September 2 API and browser review |
| Selecting a league team opens a side drawer with starter/bench groups, 2025 nflverse production, official injuries, FantasyPros-first projections, and visibly labeled validated ESPN fallback | Pass | [Weekly Prep roster drawer](images/nfldrafter-weekly-prep-roster-drawer.png) |

## Ranking review

The UI keeps FantasyPros ECR, ESPN draft rank, and Fantasy Football Calculator ADP visible as separate inputs. The composite is an explainable baseline—not a claim that any source is ground truth—and automatically reweights when a player is absent from one feed. Snapshot dates and match coverage are available from `GET /rankings/sources`.

Unexpectedly high players should be investigated through the visible source columns and rank history before changing weights. This preserves provenance and avoids hiding an upstream match or freshness problem inside a manual override.

## Data caveats verified in the UI

- ESPN native PPR points are retained for comparison. The selected profile is applied to projected box-score fields, and any ESPN fallback is explicitly counted and labeled.
- Projected role share is a directional provider-rank estimate normalized among each team's ranked RB/WR/TE players; it is not labeled as snap or possession share. Exact stat shares show how many teammate projections are included because incomplete provider coverage can inflate the result.
- Historical snap share comes from Pro Football Reference snap counts distributed by nflverse. Expected PPR and rushing opportunity come from nflverse play-level opportunity data. The UI does not substitute on-field participation for route participation or a projected role for an official depth rank.
- The FantasyPros free API tier limits each response to 10 records. NFLDrafter makes one cached request per position, refreshes weekly, serves stale data on provider/quota failures, and keeps UI reads cache-only. ESPN remains the fallback outside the matched FantasyPros sample.
- Weekly Prep never lets ESPN replace an available FantasyPros projection. Fallback values must also pass position-aware plausibility bounds; rejected or unavailable values remain visibly missing instead of being presented as credible projections.
- Draft confidence describes agreement among available ranking inputs; it is not an injury, role, or performance confidence score. Availability percentages model draft position from ADP variance and must remain labeled directional.
- Ranking movement treats a lower number as better, preserves source-specific dates, and does not connect missing matches. On August 7, the live QA showed three matched feeds for Jahmyr Gibbs: FantasyPros through July 31, FFC through August 6, and ESPN through August 7.
- Strength-of-schedule rank is based on prior-season PPR points allowed by position. Rank 1 is easiest in the model and is descriptive context, not a forecast.
- Injury and news panels can legitimately be empty when no current, player-relevant record is available.
- Yahoo OAuth and the supported read-only league resources were exercised against a credentialed 2026 league on August 24, 2026. The selected league and its snapshot persist locally; manual mode does not depend on Yahoo remaining available.

## Release checks

Run the automated release gate from the repository root:

```bash
make check
```

It runs backend tests, the maintained frontend suite, Python compilation, and the production frontend build. Browser QA remains necessary for layout, interaction, and source-attribution review until Playwright coverage is added.
