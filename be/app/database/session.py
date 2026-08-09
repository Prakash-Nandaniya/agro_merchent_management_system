from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from .engine import engine, ai_agent_engine, sync_engine

SyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine,
)
SessionLocal = SyncSessionLocal

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

AgentSessionLocal = async_sessionmaker(
    ai_agent_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


async def get_agent_db():
    async with AgentSessionLocal() as db:
        yield db