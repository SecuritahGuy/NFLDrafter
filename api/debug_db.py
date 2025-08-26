import asyncio
from app.db import get_db_session
from app.models import Player
from sqlalchemy import select

async def count_players():
    async with get_db_session() as session:
        result = await session.execute(select(Player))
        players = result.scalars().all()
        print(f'Total players: {len(players)}')
        if players:
            print(f'First player: {players[0].full_name} ({players[0].position})')

if __name__ == "__main__":
    asyncio.run(count_players())
