# Browser QA Evidence

This record captures the August 2026 manual browser review used to validate the revived Draft Room and Player Explorer. The images in `docs/images` are application screenshots from that QA run and can be reused in the README and GitHub Pages site.

## Coverage

| Scenario | Result | Evidence |
| --- | --- | --- |
| Draft Room loads its persisted manual session and source-aware board | Pass | [Draft Room](images/nfldrafter-draft-room-live.jpg) |
| Fantasy player universe exposes 1,002 players across QB, RB, WR, TE, K, and 32 D/ST units | Pass | [Player Explorer](images/nfldrafter-player-explorer-live.png) |
| Search and position filters expose quarterbacks and defenses that were previously absent | Pass | [Draft Room](images/nfldrafter-draft-room-live.jpg) |
| Selecting a player in the Draft Room opens the shared detail experience | Pass | [Draft Room detail](images/nfldrafter-draft-room-player-detail.png) |
| Selecting a player in the Player Explorer opens the same detailed profile | Pass | [Player detail](images/nfldrafter-player-detail.png) |
| Detail includes last-season totals and position-specific advanced usage | Pass | [Analytics](images/nfldrafter-player-detail-analytics.jpg) |
| ESPN season and weekly projections include projected stat lines and ownership context | Pass | [Projection breakdown](images/nfldrafter-player-projection-breakdown.jpg) |
| Schedule strength, official injury reports, and linked headlines render together | Pass | [Player context](images/nfldrafter-player-detail-context.jpg) |
| Custom scoring profile builder remains usable after the navigation redesign | Pass | [Scoring builder](images/nfldrafter-scoring-builder.png) |

## Ranking review

The UI keeps FantasyPros ECR, ESPN draft rank, and Fantasy Football Calculator ADP visible as separate inputs. The composite is an explainable baseline—not a claim that any source is ground truth—and automatically reweights when a player is absent from one feed. Snapshot dates and match coverage are available from `GET /rankings/sources`.

Unexpectedly high players should be investigated through the visible source columns and rank history before changing weights. This preserves provenance and avoids hiding an upstream match or freshness problem inside a manual override.

## Data caveats verified in the UI

- ESPN projected fantasy points currently use conventional PPR math applied to projected box-score fields; they are not yet scored through the selected custom profile.
- Strength-of-schedule rank is based on prior-season PPR points allowed by position. Rank 1 is easiest in the model and is descriptive context, not a forecast.
- Injury and news panels can legitimately be empty when no current, player-relevant record is available.
- Yahoo OAuth was exercised through the configuration/error boundary, while a live credentialed league import remains a separate dress rehearsal.

## Release checks

Run the automated release gate from the repository root:

```bash
make check
```

It runs backend tests, the maintained frontend suite, Python compilation, and the production frontend build. Browser QA remains necessary for layout, interaction, and source-attribution review until Playwright coverage is added.
