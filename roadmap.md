awesome—Option A it is. We’ll keep everything local-only with SQLite (WAL mode), but architect so you can swap Postgres later. Below is a ready-to-build plan with scaffolding, schemas, and key code snippets.

⸻

Stack (local)
	•	Frontend: React + Vite + TypeScript, TanStack Query, Tailwind, Recharts.
	•	API: FastAPI + Pydantic v2, SQLAlchemy 2.x (async with aiosqlite), httpx.
	•	Jobs/ETL: Typer CLI + APScheduler (background polls), pandas, nfl_data_py.
	•	DB: SQLite (sqlite+aiosqlite://…), WAL enabled, FTS5 for news search.

Why these libs:
	•	nfl_data_py gives weekly/seasonal player data, IDs, and more (incl. import_weekly_data, import_ids).  ￼ ￼ ￼
	•	Yahoo Fantasy requires 3-legged OAuth; we’ll do a local callback with Authlib + FastAPI.  ￼ ￼ ￼
	•	News via ESPN NFL RSS (and others) with publisher usage rules respected.  ￼

⸻

Repo layout

fantasy-open-scorer/
├─ frontend/                      # Vite React app
├─ api/                           # FastAPI service
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ deps.py
│  │  ├─ db.py
│  │  ├─ models.py
│  │  ├─ schemas.py
│  │  ├─ scoring.py
│  │  ├─ routers/
│  │  │  ├─ players.py
│  │  │  ├─ scoring_profiles.py
│  │  │  ├─ fantasy.py
│  │  │  ├─ news.py
│  │  │  └─ yahoo.py
│  │  └─ services/
│  │     ├─ nflverse.py
│  │     ├─ yahoo_oauth.py
│  │     └─ news_ingest.py
│  ├─ cli.py                      # Typer commands (ETL / admin)
│  └─ alembic/                    # migrations (optional but nice)
├─ .env.example
├─ pyproject.toml
└─ README.md


⸻

Bootstrap commands

# backend
uv venv && source .venv/bin/activate   # or: pyenv/poetry, your call
pip install -U uv
uv pip install fastapi "uvicorn[standard]" sqlalchemy aiosqlite pydantic httpx \
                  alembic typer pandas feedparser nfl_data_py apscheduler python-dotenv authlib

# frontend
npm create vite@latest frontend -- --template react-ts
cd frontend && npm i @tanstack/react-query @tanstack/react-table recharts axios tailwindcss postcss autoprefixer && npx tailwindcss init -p


⸻

Config (.env)

# DB
DATABASE_URL=sqlite+aiosqlite:///./fantasy.db

# Yahoo OAuth (local)
YAHOO_CLIENT_ID=your_client_id
YAHOO_CLIENT_SECRET=your_client_secret
YAHOO_REDIRECT_URI=http://localhost:8000/auth/yahoo/callback

# RSS sources (comma-separated)
NEWS_FEEDS=https://www.espn.com/espn/rss/nfl/news


⸻

DB schema (SQLite, SQLAlchemy 2.x)

# api/app/models.py
from __future__ import annotations
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, UniqueConstraint, Index, Text, JSON

class Base(DeclarativeBase): pass

class Player(Base):
    __tablename__ = "players"
    player_id: Mapped[str] = mapped_column(String, primary_key=True)
    full_name: Mapped[str] = mapped_column(String, index=True)
    position: Mapped[str] = mapped_column(String(5), index=True)
    team: Mapped[str] = mapped_column(String(5), index=True, nullable=True)
    nflverse_id: Mapped[str | None] = mapped_column(String, index=True)
    yahoo_id: Mapped[str | None] = mapped_column(String, index=True)
    sleeper_id: Mapped[str | None] = mapped_column(String, index=True)

class PlayerWeekStat(Base):
    __tablename__ = "player_week_stats"
    player_id: Mapped[str] = mapped_column(ForeignKey("players.player_id"), primary_key=True)
    season: Mapped[int] = mapped_column(Integer, primary_key=True)
    week: Mapped[int] = mapped_column(Integer, primary_key=True)
    stat_key: Mapped[str] = mapped_column(String, primary_key=True)
    stat_value: Mapped[float] = mapped_column(Float, default=0.0)
    __table_args__ = (
        Index("ix_pws_player_season_week", "player_id", "season", "week"),
    )

class ScoringProfile(Base):
    __tablename__ = "scoring_profiles"
    profile_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)

class ScoringRule(Base):
    __tablename__ = "scoring_rules"
    rule_id: Mapped[str] = mapped_column(String, primary_key=True)
    profile_id: Mapped[str] = mapped_column(ForeignKey("scoring_profiles.profile_id"))
    stat_key: Mapped[str] = mapped_column(String)
    multiplier: Mapped[float] = mapped_column(Float, default=0.0)
    per: Mapped[float | None] = mapped_column(Float, nullable=True)
    bonus_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    bonus_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    bonus_points: Mapped[float | None] = mapped_column(Float, nullable=True)
    cap: Mapped[float | None] = mapped_column(Float, nullable=True)
    __table_args__ = (Index("ix_rules_profile", "profile_id"),)

class NewsItem(Base):
    __tablename__ = "news_items"
    news_id: Mapped[str] = mapped_column(String, primary_key=True)
    published_at: Mapped[int] = mapped_column(Integer, index=True)  # epoch ms
    source: Mapped[str] = mapped_column(String)
    url: Mapped[str] = mapped_column(String, unique=True)
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    players: Mapped[dict] = mapped_column(JSON)   # {player_id: score}
    dedupe_hash: Mapped[str] = mapped_column(String, unique=True)

Enable WAL and FTS5 at startup:

# api/app/db.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import event
from .models import Base

engine = create_async_engine("sqlite+aiosqlite:///./fantasy.db", future=True)

@event.listens_for(engine.sync_engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("PRAGMA synchronous=NORMAL;")
    cur.execute("PRAGMA foreign_keys=ON;")
    cur.close()

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

(You can add an FTS virtual table news_items_fts mirroring title/summary, with triggers for insert/update.)

⸻

Scoring engine

# api/app/scoring.py
from math import floor
from typing import Dict, Iterable

def compute_points(stats: Dict[str, float], rules: Iterable[dict]) -> float:
    total = 0.0
    for r in rules:
        val = float(stats.get(r["stat_key"], 0) or 0)
        units = floor(val / r["per"]) if r.get("per") else val
        base = units * float(r.get("multiplier", 0))
        bonus = 0.0
        if r.get("bonus_min") is not None:
            if val >= r["bonus_min"] and (r.get("bonus_max") is None or val <= r["bonus_max"]):
                bonus = float(r.get("bonus_points", 0))
        subtotal = base + bonus
        total += min(subtotal, r["cap"]) if r.get("cap") else subtotal
    return round(total, 2)


⸻

Ingestion (historical + weekly refresh)

# api/app/services/nflverse.py
import pandas as pd
import uuid
from nfl_data_py import import_weekly_data, import_ids
from sqlalchemy import insert
from ..db import SessionLocal
from ..models import Player, PlayerWeekStat

async def seed_players_and_ids():
    ids = import_ids()    # includes cross-site IDs; map to Yahoo when present
    ids = ids.rename(columns=str.lower)
    async with SessionLocal() as s, s.begin():
        for _, row in ids.iterrows():
            pid = row.get("gsis_id") or row.get("nfl_id") or str(uuid.uuid4())
            await s.execute(insert(Player).prefix_with("OR IGNORE").values(
                player_id=pid,
                full_name=row.get("full_name") or row.get("display_name"),
                position=row.get("position"),
                team=row.get("team"),
                nflverse_id=row.get("gsis_id"),
                yahoo_id=row.get("yahoo_id"),
                sleeper_id=row.get("sleeper_id"),
            ))

async def ingest_weekly_stats(seasons: list[int]):
    df = import_weekly_data(seasons)  # offense/defense/kicking in long-ish form
    # normalize to long stat_key/stat_value per player/week
    key_cols = ["player_id","season","week"]
    # nfl_data_py uses e.g. 'player_id'/'player_name'—adjust if needed per dataframe columns
    wide_stats = df.set_index(key_cols).select_dtypes("number")
    long_df = wide_stats.stack().reset_index().rename(columns={"level_3":"stat_key",0:"stat_value"})
    async with SessionLocal() as s, s.begin():
        for _, r in long_df.iterrows():
            await s.execute(insert(PlayerWeekStat).prefix_with("OR REPLACE").values(
                player_id=str(r["player_id"]), season=int(r["season"]), week=int(r["week"]),
                stat_key=str(r["stat_key"]), stat_value=float(r["stat_value"] or 0.0)
            ))

	•	import_weekly_data/import_ids are standard functions in nfl_data_py.  ￼ ￼

Add a Typer CLI to run ETL:

# api/cli.py
import asyncio, uuid, typer
from app.services.nflverse import seed_players_and_ids, ingest_weekly_stats

cli = typer.Typer()

@cli.command()
def seed():
    asyncio.run(seed_players_and_ids())
    typer.echo("Seeded players + IDs.")

@cli.command()
def load(seasons: str = typer.Argument("2022,2023,2024")):
    years = [int(y) for y in seasons.split(",")]
    asyncio.run(ingest_weekly_stats(years))
    typer.echo(f"Ingested weekly stats for {years}")

if __name__ == "__main__":
    cli()


⸻

API routes (selected)

# api/app/routers/fantasy.py
from fastapi import APIRouter, Depends
from sqlalchemy import select
from ..db import SessionLocal
from ..models import PlayerWeekStat, ScoringRule
from ..scoring import compute_points

router = APIRouter(prefix="/fantasy", tags=["fantasy"])

@router.get("/points")
async def points(player_id: str, season: int, week: int, profile_id: str):
    async with SessionLocal() as s:
        res = await s.execute(select(PlayerWeekStat.stat_key, PlayerWeekStat.stat_value)
                              .where(PlayerWeekStat.player_id==player_id,
                                     PlayerWeekStat.season==season,
                                     PlayerWeekStat.week==week))
        stats = {k:v for k,v in res.all()}
        rules = (await s.execute(select(ScoringRule).where(ScoringRule.profile_id==profile_id))).scalars().all()
        rules_json = [dict(stat_key=r.stat_key, multiplier=r.multiplier, per=r.per,
                           bonus_min=r.bonus_min, bonus_max=r.bonus_max,
                           bonus_points=r.bonus_points, cap=r.cap) for r in rules]
        return {"points": compute_points(stats, rules_json), "stats": stats}

# api/app/main.py
from fastapi import FastAPI
from .routers import fantasy, players, scoring_profiles, news, yahoo
from .db import engine
from .models import Base

app = FastAPI(title="Fantasy Open Scorer (Local)")
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(fantasy.router)
# ...add others

Run it:

uvicorn app.main:app --reload --port 8000


⸻

Yahoo OAuth (local callback)
	•	Create a Yahoo app, set redirect to http://localhost:8000/auth/yahoo/callback.  ￼
	•	Implement 3-legged OAuth with Authlib’s FastAPI client.  ￼ ￼

# api/app/services/yahoo_oauth.py
from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request
import os

oauth = OAuth()
oauth.register(
    name="yahoo",
    client_id=os.getenv("YAHOO_CLIENT_ID"),
    client_secret=os.getenv("YAHOO_CLIENT_SECRET"),
    access_token_url="https://api.login.yahoo.com/oauth2/get_token",
    authorize_url="https://api.login.yahoo.com/oauth2/request_auth",
    client_kwargs={"scope": "fspt-r fspt-w"},
)

# api/app/routers/yahoo.py
from fastapi import APIRouter, Request
from starlette.responses import RedirectResponse
from ..services.yahoo_oauth import oauth
import os

router = APIRouter(prefix="/auth/yahoo", tags=["yahoo"])

@router.get("/login")
async def login(request: Request):
    redirect_uri = os.getenv("YAHOO_REDIRECT_URI")
    return await oauth.yahoo.authorize_redirect(request, redirect_uri)

@router.get("/callback")
async def callback(request: Request):
    token = await oauth.yahoo.authorize_access_token(request)
    # store token in local sqlite if you want multi-session; otherwise in memory
    return RedirectResponse(url="/")  # FE route

Yahoo Fantasy’s endpoints require this 3-leg flow for user data (leagues/teams).  ￼

⸻

News ingestion (RSS → SQLite + FTS)

# api/app/services/news_ingest.py
import feedparser, hashlib, time, uuid
from sqlalchemy import insert
from ..db import SessionLocal
from ..models import NewsItem

def _hash(url: str, title: str) -> str:
    return hashlib.sha256(f"{url}|{title}".encode()).hexdigest()

async def ingest_feeds(feeds: list[str]):
    now = int(time.time() * 1000)
    for feed in feeds:
        parsed = feedparser.parse(feed)
        async with SessionLocal() as s, s.begin():
            for e in parsed.entries:
                url = e.link
                title = e.title
                summary = getattr(e, "summary", "")
                h = _hash(url, title)
                await s.execute(insert(NewsItem).prefix_with("OR IGNORE").values(
                    news_id=str(uuid.uuid4()),
                    published_at=now,
                    source=feed, url=url, title=title, summary=summary,
                    players={}, dedupe_hash=h
                ))

ESPN’s RSS usage requires linking to the original and showing only content provided by the feed—this code respects that.  ￼

Schedule it (optional) with APScheduler (in main.py on startup).

⸻

Frontend (MVP screens)
	•	Scoring Builder: CRUD rules; preview section calling /fantasy/points.
	•	Player Explorer: table (virtualized) of players; select seasons; fetch raw stats and computed points; quick compare of two profiles (“Yahoo-like” vs “Mine”).
	•	News: per-player filter + global feed (search powered by FTS).

Example React hook:

// frontend/src/api.ts
import axios from "axios";
export const api = axios.create({ baseURL: "http://localhost:8000" });

// frontend/src/hooks/usePoints.ts
import { useQuery } from '@tanstack/react-query';
export function usePoints(player_id: string, season: number, week: number, profile_id: string) {
  return useQuery({
    queryKey: ['points', player_id, season, week, profile_id],
    queryFn: async () => (await api.get('/fantasy/points', { params: { player_id, season, week, profile_id }})).data,
    enabled: !!player_id
  });
}


⸻

Developer workflows

Seed data (first run):

cd api
python cli.py seed
python cli.py load 2022,2023,2024
uvicorn app.main:app --reload --port 8000

Quality guardrails
	•	Unit tests for compute_points with known snapshots (golden files).
	•	Lints/format: ruff + black + mypy.
	•	Simple perf test: compute all RBs for week 1 under 50ms/profile.

Security (local)
	•	Keep OAuth secrets in .env and .gitignore it.
	•	Validate/cap query params (season ranges, week 1–18).
	•	SQLite PRAGMAs as above; backups by copying the .db (WAL safe).

⸻

Roadmap (local)
	1.	MVP (you can draft with it)
	•	Seed players/IDs, ingest seasons you want.
	•	Scoring Profiles CRUD + points endpoint.
	•	Player Explorer UI + News feed.
	2.	Yahoo Overlay (local)
	•	3-leg OAuth, get leagues/teams/rosters; map with import_ids()’ Yahoo IDs; highlight your roster in Explorer.  ￼
	3.	Quality & UX
	•	Tiering, watchlist, ADP overlay (free Sleeper endpoints later).
	•	Export/import scoring profiles (JSON files).
	4.	Future toggles
	•	Swap SQLite → Postgres by changing DATABASE_URL.
	•	Add projections (local models) and what-if boards.
	•	Live game hooks (only if you decide to add a paid real-time feed).

⸻

If you want, I can turn this into a repo starter: pyproject.toml, working FastAPI app with the models above, the Typer ETL, and a minimal React “Scoring Builder + Player Explorer” that hits /fantasy/points. You’ll be able to run seed/load, open the UI, and immediately compare custom points across seasons.