# Browser QA Evidence

This record captures the August 2026 manual browser review used to validate the revived Draft Room and Player Explorer. The images in `docs/images` are application screenshots from that QA run and can be reused in the README and GitHub Pages site.

## Coverage

| Scenario | Result | Evidence |
| --- | --- | --- |
| Draft Room loads its persisted manual session and source-aware board | Pass | [Draft Room](images/nfldrafter-draft-room-live.jpg) |
| Manual tracker assigns snake-order ownership, removes drafted players from the board, records the full ledger, and restores players on undo | Pass | [Manual tracker](images/manual-draft-tracker.png) |
| Fantasy player universe exposes 1,002 players across QB, RB, WR, TE, K, and 32 D/ST units | Pass | [Player Explorer](images/nfldrafter-player-explorer-live.png) |
| Search and position filters expose quarterbacks and defenses that were previously absent | Pass | [Draft Room](images/nfldrafter-draft-room-live.jpg) |
| Selecting a player in the Draft Room opens the shared detail experience | Pass | [Draft Room detail](images/nfldrafter-draft-room-player-detail.png) |
| Selecting a player in the Player Explorer opens the same detailed profile | Pass | [Player detail](images/nfldrafter-player-detail.png) |
| Detail includes last-season totals and position-specific advanced usage | Pass | [Analytics](images/nfldrafter-player-detail-analytics.jpg) |
| ESPN season and weekly projections include projected stat lines and ownership context | Pass | [Projection breakdown](images/nfldrafter-player-projection-breakdown.jpg) |
| Player detail derives a team-role estimate and available target/carry/yard shares from ranked teammate projections, with coverage caveats | Pass | [Projected team role](images/nfldrafter-projected-team-role.png) |
| Official FantasyPros projection samples load through the seven-day SQLite cache, match 60/60 players, and receive explicit provider attribution | Pass | [FantasyPros projections](images/nfldrafter-fantasypros-projections.png) |
| Schedule strength, official injury reports, and linked headlines render together | Pass | [Player context](images/nfldrafter-player-detail-context.jpg) |
| Custom scoring profile builder remains usable after the navigation redesign | Pass | [Scoring builder](images/nfldrafter-scoring-builder.png) |
| Selecting PPR re-scores ESPN season and weekly stat lines in the shared player drawer | Pass | [Profile-scored detail](images/nfldrafter-profile-scored-projections.png) |
| Draft Room renders league-aware position tiers and VORP without grouping unprojected players into fake tiers | Pass | [Projection analytics panel](images/nfldrafter-projection-analytics-panel.png) |
| Yahoo card confirms server credential readiness without exposing the client ID or secret | Pass | [Yahoo OAuth readiness](images/nfldrafter-yahoo-readiness.jpg) |
| Yahoo authorization returns through the configured callback and the Draft Room renders the connected state | Pass | [Yahoo OAuth readiness](images/nfldrafter-yahoo-readiness.jpg) plus the August 7 live sign-in rehearsal |
| Credentialed Yahoo league import against live Fantasy Sports data | Pending provider access | The OAuth handoff succeeds, but league/settings verification still requires approved Fantasy Sports API access for the application |
| Yahoo fixture rehearsal previews teams, rosters, slots, and scoring rules, then reports match coverage | Pass | Frontend component tests plus backend XML/scoring/player-matching tests |

## Ranking review

The UI keeps FantasyPros ECR, ESPN draft rank, and Fantasy Football Calculator ADP visible as separate inputs. The composite is an explainable baseline—not a claim that any source is ground truth—and automatically reweights when a player is absent from one feed. Snapshot dates and match coverage are available from `GET /rankings/sources`.

Unexpectedly high players should be investigated through the visible source columns and rank history before changing weights. This preserves provenance and avoids hiding an upstream match or freshness problem inside a manual override.

## Data caveats verified in the UI

- ESPN native PPR points are retained for comparison. The selected profile is applied to projected box-score fields, and any ESPN fallback is explicitly counted and labeled.
- Projected role share is a directional provider-rank estimate normalized among each team's ranked RB/WR/TE players; it is not labeled as snap or possession share. Exact stat shares show how many teammate projections are included because incomplete provider coverage can inflate the result.
- The FantasyPros free API tier limits each response to 10 records. NFLDrafter makes one cached request per position, refreshes weekly, serves stale data on provider/quota failures, and keeps UI reads cache-only. ESPN remains the fallback outside the matched FantasyPros sample.
- Strength-of-schedule rank is based on prior-season PPR points allowed by position. Rank 1 is easiest in the model and is descriptive context, not a forecast.
- Injury and news panels can legitimately be empty when no current, player-relevant record is available.
- Yahoo OAuth was exercised with the configured client ID on August 7, 2026. After the exact HTTPS callback was registered, sign-in returned to the Draft Room and rendered the connected state. A live league/settings import remains pending approved Yahoo Fantasy Sports API access; manual mode does not depend on that approval.

## Release checks

Run the automated release gate from the repository root:

```bash
make check
```

It runs backend tests, the maintained frontend suite, Python compilation, and the production frontend build. Browser QA remains necessary for layout, interaction, and source-attribution review until Playwright coverage is added.
