# NFLDrafter Revival Roadmap

Last updated: September 2, 2026

NFLDrafter is being revived as a dependable, local-first fantasy draft assistant. The manual draft workflow is the product baseline; external services add context without becoming a single point of failure.

## Shipped foundation

- Reproducible bootstrap and release gate through `make bootstrap` and `make check`
- FastAPI, React 19, TypeScript, SQLite, and an offline-capable browser draft package
- Manual snake draft with undo, correction, roster constraints, persistence, and CSV export
- A current 1,024-player fantasy pool covering QB, RB, WR, TE, K, and all 32 D/ST units
- FantasyPros ECR, ESPN draft rank, and Fantasy Football Calculator ADP stored as distinct, timestamped signals
- Isolated daily FantasyPros, ESPN, and FFC snapshot refreshes plus player-level rank-movement charts and source freshness
- Sleeper identity enrichment through the free, no-auth public API (backfills `sleeper_id` + season `PlayerIdentifier` records, matched via ESPN id first)
- Weighted composite draft rank with source attribution and missing-source reweighting
- Shared player detail from the Player Explorer and Draft Room
- Last-season totals, snap/target/rushing shares, expected-opportunity results, official FantasyPros preseason projections with a persistent seven-day cache and ESPN fallback, projection-derived team role/opportunity shares, modeled strength of schedule, official injury reports, and player-linked ESPN news
- Profile-scored season/weekly projections, league-aware replacement baselines, position tiers, VORP, and recommendation integration
- Draft confidence from source coverage/disagreement and FantasyPros ranges, directional next-pick availability from FFC ADP variance, and capped linked news context in live recommendations
- Yahoo OAuth exchange, persistent read-only league snapshot, scoring-profile import, assigned draft-order import, and season-aware player matching covered by fixtures and a credentialed live rehearsal
- Yahoo connection readiness, league-import preflight, post-import player/scoring coverage report, and database-only frontend reads
- GitHub Actions release checks, GitHub Pages documentation, and browser-QA screenshots

## Current release gate

`make check` runs the maintained backend and frontend tests, Python bytecode compilation, and a production frontend build. Browser QA scenarios and the corresponding captures live in [`docs/QA.md`](docs/QA.md).

## Next priorities

### 1. Build the weekly preparation workspace

- [x] Add a database-only Weekly Prep view for the selected Yahoo league: current matchup, roster check, league comparison, and recent activity
- [x] Match Yahoo roster identities to cached FantasyPros season projections and official injury reports, showing coverage rather than filling gaps with guesses
- [x] Add a conservative lineup-review and waiver-watch layer from saved lineup slots, official injuries, verified league availability, and cached projection coverage
- [x] Add a lazy-loaded team roster drawer with starter/bench grouping, recent nflverse production, FantasyPros projections, injuries, and explicit missing-source states
- [x] Add a validated ESPN projection fallback when FantasyPros coverage is missing, with per-player source labels, source counts, freshness dates, and plausibility bounds
- Add ESPN ranking and player-context signals beyond the projection fallback to roster comparison
- Add scoring-profile-aware weekly start/sit and waiver recommendations after weekly projection data is validated
- [x] Add a cached, read-only team-comparison view for active-lineup projection, positional starter strength, bench depth, injury exposure, and schedule outlook

### 2. Add a retrospective Draft Review

- [x] Add a post-draft report from the saved local ledger, comparing each user selection with later-drafted cached-board alternatives
- Import the completed Yahoo draft ledger and reconstruct each team’s selections
- [x] Evaluate each user pick against players selected later using the nearest cached FantasyPros ECR snapshot when available, with a local-board fallback
- Show alternatives as explainable counterfactuals (source ranks, ADP, roster need, tiers, and uncertainty), never as a claim that a different choice was definitively correct
- Start with a post-draft report; do not alter the reliable manual draft workflow

### 3. Extend the verified Yahoo integration

- [x] Keep the registered HTTPS callback synchronized with `YAHOO_REDIRECT_URI` and complete a credentialed pre-draft league rehearsal
- [x] Verify standings, roster slots, scoring modifiers, player-ID coverage, transactions, matchups, ownership, draft analysis, and completed-season stats
- Exercise token refresh recovery under an expired live token
- Add optional in-season current-week stats without weakening the database-first refresh contract
- Keep live-pick synchronization deferred until the imported preparation workflow is trustworthy

### 4. Expand opportunity coverage

- Snap share, target share, rushing share, and expected fantasy points now load from nflverse through `load-usage`
- Add route participation and official current depth-chart role only when a licensed or reliably structured source supports them directly
- Separate historical production, projected opportunity, market cost, and news signals in both the API and UI
- Surface missing or stale data explicitly

### 5. Calibrate decision confidence

- Backtest whether rank movement improves draft recommendations once enough daily history has accumulated
- Backtest the directional availability model against mock-draft outcomes
- Add tier-run alerts and calibrate recommendation weights through offline draft simulations

### 6. Automate browser regression coverage

- [x] Add a Playwright Chromium smoke suite to CI for primary navigation and the no-ledger Draft Review state
- [x] Cover seeded manual-draft selection, persisted reload, and undo in Playwright
- Extend browser coverage to player completeness, position filters, and both player-detail entry points
- Capture deterministic screenshots from seeded fixtures for pull requests and documentation
- Add keyboard and accessibility checks to the release gate

## Deferred until the core is proven

- Automated Yahoo live-pick synchronization
- Installable PWA/service-worker shell
- Redis, Postgres, and Alembic migration infrastructure
- Community scoring-profile exchange
- Live-game scoring and AI-generated news summaries

## Data and product guardrails

- Source ranks are not interchangeable: ECR represents expert opinion, ESPN represents platform ordering, and FFC represents mock-draft cost.
- Schedule strength is a prior-season, position-level model and must not be described as a projection.
- ESPN's native PPR total remains a comparison value. Profile-scored values, replacement ranks, tier thresholds, and any ESPN fallback are labeled in the API and UI.
- Yahoo remains optional. A prepared local package and manual draft must continue working when Yahoo or any ranking source is unavailable.
