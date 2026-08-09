from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings


def _to_asyncpg_url(url: str) -> str:
    """
    Neon's connection string is written for psycopg2/libpq (?sslmode=require
    &channel_binding=require). asyncpg doesn't understand either param —
    it wants ?ssl=require and has no channel_binding equivalent. This
    strips the libpq-only params and swaps in the asyncpg-compatible one.
    """
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.pop("channel_binding", None)
    if query.pop("sslmode", None):
        query["ssl"] = "require"
    new_query = urlencode(query)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


# ---------------------------------------------------------------------------
# Sync engines — psycopg2, used by SyncSessionLocal (e.g. Alembic, scripts).
# psycopg2 DOES understand sslmode/channel_binding and connect_timeout/keepalives,
# so this URL and connect_args can stay exactly as Neon gave them.
# ---------------------------------------------------------------------------
sync_engine = create_engine(
    str(settings.DATABASE_URL),
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        "connect_timeout": 5,
        "keepalives": 1,
        "keepalives_idle": 15,
        "keepalives_interval": 5,
        "keepalives_count": 3,
    },
)

sync_ai_agent_engine = create_engine(
    str(settings.AI_AGENT_DATABASE_URL),
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        "connect_timeout": 5,
        "keepalives": 1,
        "keepalives_idle": 15,
        "keepalives_interval": 5,
        "keepalives_count": 3,
    },
)

# ---------------------------------------------------------------------------
# Async engines — asyncpg, used by AsyncSessionLocal / AgentSessionLocal.
# URL is rewritten (sslmode -> ssl) and connect_args use asyncpg's own
# kwarg names — no keepalives support in asyncpg, "timeout" not "connect_timeout".
# ---------------------------------------------------------------------------
engine = create_async_engine(
    _to_asyncpg_url(str(settings.DATABASE_URL)),
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={"timeout": 5},
)

ai_agent_engine = create_async_engine(
    _to_asyncpg_url(str(settings.AI_AGENT_DATABASE_URL)),
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={"timeout": 5},
)