import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.models.session import Session
from app.core.exceptions import NotAuthenticatedException


async def create_session(db: AsyncSession, user_name: str) -> Session:
    session = Session(session_user_name=user_name)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_session_user(db: AsyncSession, session_id: uuid.UUID) -> str:
    res = await db.execute(select(Session).where(Session.id == session_id))
    session = res.scalar_one_or_none()

    if session is None:
        raise NotAuthenticatedException("Session expired or invalid")

    return session.session_user_name


async def delete_session(db: AsyncSession, session_id: uuid.UUID) -> None:
    res = await db.execute(select(Session).where(Session.id == session_id))
    session = res.scalar_one_or_none()

    if session is not None:
        db.delete(session)
        await db.commit()