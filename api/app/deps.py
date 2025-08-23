from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from .db import get_db


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async for session in get_db():
        yield session
