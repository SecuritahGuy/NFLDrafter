# NFLDrafter Revival Roadmap

Last updated: August 7, 2026

NFLDrafter is being revived as a dependable, local-first fantasy draft assistant. The manual draft workflow is the product baseline; external services add context without becoming a single point of failure.

## Shipped foundation

- Reproducible bootstrap and release gate through `make bootstrap` and `make check`
- FastAPI, React 19, TypeScript, SQLite, and an offline-capable browser draft package
- Manual snake draft with undo, correction, roster constraints, persistence, and CSV export
- A current 1,002-player fantasy pool covering QB, RB, WR, TE, K, and all 32 D/ST units
- FantasyPros ECR, ESPN draft rank, and Fantasy Football Calculator ADP stored as distinct, timestamped signals
- Sleeper identity enrichment through the free, no-auth public API (backfills `sleeper_id` + season `PlayerIdentifier` records, matched via ESPN id first)
- Weighted composite draft rank with source attribution and missing-source reweighting
- Shared player detail from the Player Explorer and Draft Room
- Last-season totals and position-specific usage, official FantasyPros preseason projections with a persistent seven-day cache and ESPN fallback, projection-derived team role/opportunity shares, modeled strength of schedule, official injury reports, and player-linked ESPN news
- Profile-scored season/weekly projections, league-aware replacement baselines, position tiers, VORP, and recommendation integration
- Yahoo OAuth exchange, league/settings/team/roster parsing, scoring-profile import, and season-aware player matching covered by fixtures
- Yahoo connection readiness, league-import preflight, and post-import player/scoring coverage report
- GitHub Actions release checks, GitHub Pages documentation, and browser-QA screenshots

## Current release gate

`make check` runs the maintained backend and frontend tests, Python bytecode compilation, and a production frontend build. Browser QA scenarios and the corresponding captures live in [`docs/QA.md`](docs/QA.md).

## Next priorities

### 1. Run the Yahoo dress rehearsal

- Keep the registered HTTPS callback synchronized with `YAHOO_REDIRECT_URI`; the August 7 live sign-in handoff completed successfully after correcting it
- Complete Yahoo's Fantasy Sports API access process for the application
- Complete one credentialed OAuth flow against the user's league
- Verify imported roster slots, scoring categories, teams, and player-ID coverage
- Exercise token refresh and document the recovery path
- Keep live-pick synchronization deferred until the imported preparation workflow is trustworthy

### 2. Add opportunity context

- Incorporate snap share, route participation, target share, rushing share, and depth-chart role where reliable sources permit
- Separate historical production, projected opportunity, market cost, and news signals in both the API and UI
- Surface missing or stale data explicitly

### 3. Improve decision confidence

- Retain and chart ranking movement across snapshots
- Turn FantasyPros ranges and source disagreement into a visible confidence indicator
- Estimate next-pick availability from ADP distributions without presenting it as certainty

### 4. Automate browser regression coverage

- Add Playwright coverage for player completeness, position filters, draft selection, undo, persistence, and both player-detail entry points
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
