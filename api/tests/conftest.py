import pytest
import pytest_asyncio
import asyncio
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.main import app
from app.deps import get_db_session
from app.models import Base, Player, PlayerRanking, ScoringProfile, ScoringRule


# Test database URL - use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    future=True
)

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_db_setup():
    """Set up test database tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            Player.__table__.insert().values(
                player_id="fixture-qb",
                full_name="Fixture Quarterback",
                position="QB",
                team="KC",
                nflverse_id="fixture-qb",
                espn_id="1",
                last_season=2026,
                status="ACT",
            )
        )
        await conn.execute(
            Player.__table__.insert(),
            [
                {"player_id": "fixture-wr-1", "full_name": "Fixture Receiver One", "position": "WR", "team": "KC", "last_season": 2026, "status": "ACT"},
                {"player_id": "fixture-wr-2", "full_name": "Fixture Receiver Two", "position": "WR", "team": "BUF", "last_season": 2026, "status": "ACT"},
            ],
        )
        await conn.execute(
            ScoringProfile.__table__.insert().values(
                profile_id="fixture-ppr",
                name="Fixture PPR",
                description="Test scoring profile",
                is_public=True,
                created_at=0,
            )
        )
        await conn.execute(
            ScoringRule.__table__.insert().values(
                rule_id="fixture-receptions",
                profile_id="fixture-ppr",
                stat_key="receptions",
                multiplier=1.0,
                per=1.0,
            )
        )
        await conn.execute(
            PlayerRanking.__table__.insert(),
            [
                {
                    "ranking_id": "fixture-espn-1", "player_id": "fixture-wr-1",
                    "full_name": "Fixture Receiver One", "position": "WR", "team": "KC",
                    "source": "espn-draft-rank", "rank_type": "preseason", "scoring": "PPR",
                    "season": 2026, "rank": 1, "snapshot_date": "2026-08-07", "snapshot_ts": 1,
                    "raw": {"projected_points": 200, "projected_stats": {"receptions": 100}, "weekly_projections": []},
                },
                {
                    "ranking_id": "fixture-espn-2", "player_id": "fixture-wr-2",
                    "full_name": "Fixture Receiver Two", "position": "WR", "team": "BUF",
                    "source": "espn-draft-rank", "rank_type": "preseason", "scoring": "PPR",
                    "season": 2026, "rank": 2, "snapshot_date": "2026-08-07", "snapshot_ts": 1,
                    "raw": {"projected_points": 150, "projected_stats": {"receptions": 70}, "weekly_projections": []},
                },
            ],
        )
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(test_db_setup) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async with test_engine.connect() as connection:
        transaction = await connection.begin()
        async with AsyncSession(bind=connection, expire_on_commit=False) as session:
            try:
                yield session
            finally:
                await session.close()
                if transaction.is_active:
                    await transaction.rollback()


@pytest.fixture
def override_get_db(db_session: AsyncSession):
    """Override the get_db dependency for testing."""
    async def _override_get_db():
        yield db_session
    
    return _override_get_db


@pytest.fixture
def client(override_get_db) -> TestClient:
    """Create a test client with overridden dependencies."""
    app.dependency_overrides[get_db_session] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
async def async_client(override_get_db) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with overridden dependencies."""
    app.dependency_overrides[get_db_session] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def sample_scoring_rules():
    """Sample scoring rules for testing."""
    return [
        {
            "stat_key": "passing_yards",
            "multiplier": 0.04,
            "per": 1,
            "bonus_min": 300,
            "bonus_points": 3,
            "cap": None
        },
        {
            "stat_key": "passing_touchdowns",
            "multiplier": 4,
            "per": 1,
            "bonus_min": None,
            "bonus_points": 0,
            "cap": None
        },
        {
            "stat_key": "interceptions",
            "multiplier": -2.0,
            "per": 1,
            "bonus_min": None,
            "bonus_points": 0,
            "cap": None
        },
        {
            "stat_key": "rushing_yards",
            "multiplier": 0.1,
            "per": 1,
            "bonus_min": 100,
            "bonus_points": 2,
            "cap": None
        },
        {
            "stat_key": "rushing_touchdowns",
            "multiplier": 6.0,
            "per": 1,
            "bonus_min": None,
            "bonus_points": 0,
            "cap": None
        },
        {
            "stat_key": "receptions",
            "multiplier": 1.0,
            "per": 1,
            "bonus_min": None,
            "bonus_points": 0,
            "cap": None
        }
    ]


@pytest.fixture
def sample_player_stats():
    """Sample player statistics for testing."""
    return {
        "passing_yards": 350,
        "passing_touchdowns": 3,
        "rushing_yards": 45,
        "interceptions": 1,
        "fumbles_lost": 0
    }


@pytest.fixture
def sample_player():
    """Sample player data for testing."""
    return {
        "player_id": "test-player-123",
        "full_name": "Test Quarterback",
        "position": "QB",
        "team": "TEST",
        "nflverse_id": "test-123",
        "yahoo_id": "12345",
        "sleeper_id": "67890"
    }
