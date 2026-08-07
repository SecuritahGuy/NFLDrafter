from app.services.sleeper import backfill_sleeper_ids


class FakeProvider:
    def __init__(self, records, state=None):
        self._records = records
        self._state = state or {"league_season": "2026"}

    def load_players(self):
        return self._records

    def load_season_state(self):
        return self._state


def test_backfill_matches_by_espn_id_and_persists_identifier():
    import asyncio

    from app.models import Base, Player, PlayerIdentifier
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        test_sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with test_sessionmaker() as s:
            s.add(
                Player(
                    player_id="qb-1",
                    full_name="Fixture Quarterback",
                    position="QB",
                    team="KC",
                    espn_id="1",
                )
            )
            await s.commit()

            result = await backfill_sleeper_ids(
                provider=FakeProvider(
                    [
                        {
                            "player_id": "sleeper-123",
                            "full_name": "Fixture Quarterback",
                            "position": "QB",
                            "team": "KC",
                            "espn_id": "1",
                        }
                    ]
                ),
                session=s,
            )

            player = (await s.execute(select(Player).where(Player.player_id == "qb-1"))).scalar_one()
            ident = (
                await s.execute(
                    select(PlayerIdentifier).where(PlayerIdentifier.platform == "sleeper")
                )
            ).scalar_one()

            return result, player, ident

        await engine.dispose()

    result, player, ident = asyncio.run(run())
    assert result["matched"] == 1
    assert result["ambiguous"] == 0
    assert result["season"] == 2026
    assert player.sleeper_id == "sleeper-123"
    assert ident.external_id == "sleeper-123"
    assert ident.canonical_player_id == "qb-1"
    assert ident.match_method == "espn_id"


def test_backfill_is_idempotent_on_refresh():
    import asyncio

    from app.models import Base, Player, PlayerIdentifier
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        test_sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with test_sessionmaker() as s:
            s.add(
                Player(
                    player_id="qb-1",
                    full_name="Fixture Quarterback",
                    position="QB",
                    team="KC",
                    espn_id="1",
                )
            )
            await s.commit()

            records = [
                {
                    "player_id": "sleeper-123",
                    "full_name": "Fixture Quarterback",
                    "position": "QB",
                    "team": "KC",
                    "espn_id": "1",
                }
            ]
            await backfill_sleeper_ids(provider=FakeProvider(records), session=s)
            await backfill_sleeper_ids(provider=FakeProvider(records), session=s)

            idents = list(
                (await s.execute(select(PlayerIdentifier))).scalars().all()
            )
            return len(idents)

        await engine.dispose()

    assert asyncio.run(run()) == 1


def test_backfill_matches_no_espn_id_via_name_team_position():
    import asyncio

    from app.models import Base, Player, PlayerIdentifier
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        test_sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with test_sessionmaker() as s:
            s.add(
                Player(
                    player_id="rb-1",
                    full_name="Fixture Running Back",
                    position="RB",
                    team="BUF",
                )
            )
            await s.commit()

            result = await backfill_sleeper_ids(
                provider=FakeProvider(
                    [
                        {
                            "player_id": "sleeper-456",
                            "full_name": "Fixture Running Back",
                            "position": "RB",
                            "team": "BUF",
                        }
                    ]
                ),
                session=s,
            )

            ident = (
                await s.execute(
                    select(PlayerIdentifier).where(PlayerIdentifier.platform == "sleeper")
                )
            ).scalar_one()
            return result, ident

        await engine.dispose()

    result, ident = asyncio.run(run())
    assert result["matched"] == 1
    assert ident.match_method == "name_position_team"
    assert ident.external_id == "sleeper-456"
    assert ident.canonical_player_id == "rb-1"
