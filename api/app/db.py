import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import event, text
from .models import Base
from typing import AsyncGenerator


# Database URL from environment or default to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./fantasy.db")

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    future=True,
    echo=os.getenv("DEBUG", "false").lower() == "true"
)

# Configure SQLite optimizations
@event.listens_for(engine.sync_engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    """Configure SQLite for optimal performance"""
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("PRAGMA synchronous=NORMAL;")
    cur.execute("PRAGMA foreign_keys=ON;")
    cur.execute("PRAGMA cache_size=10000;")
    cur.execute("PRAGMA temp_store=MEMORY;")
    cur.close()


# Create session factory
SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables and FTS5 virtual table"""
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
        # Create FTS5 virtual table for news search if using SQLite
        if "sqlite" in DATABASE_URL:
            await conn.execute(text("""
                CREATE VIRTUAL TABLE IF NOT EXISTS news_items_fts 
                USING fts5(title, summary, content='news_items', content_rowid='rowid');
            """))
            
            # Create triggers for FTS5
            await conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS news_items_ai AFTER INSERT ON news_items BEGIN
                    INSERT INTO news_items_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
                END;
            """))
            
            await conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS news_items_ad AFTER DELETE ON news_items BEGIN
                    INSERT INTO news_items_fts(news_items_fts, rowid, title, summary) VALUES('delete', old.rowid, old.title, old.summary);
                END;
            """))
            
            await conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS news_items_au AFTER UPDATE ON news_items BEGIN
                    INSERT INTO news_items_fts(news_items_fts, rowid, title, summary) VALUES('delete', old.rowid, old.title, old.summary);
                    INSERT INTO news_items_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
                END;
            """))
