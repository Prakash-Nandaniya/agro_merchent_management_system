import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session as ORMSession  
from app.database.models.session import Session
from app.core.exceptions import NotAuthenticatedException


def create_session(db: ORMSession, user_name: str) -> Session:
    session = Session(session_user_name=user_name)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session_user(db: ORMSession, session_id: uuid.UUID) -> str:
    session = db.execute(
        select(Session).where(Session.id == session_id)
    ).scalar_one_or_none()

    if session is None:
        raise NotAuthenticatedException("Session expired or invalid")

    return session.session_user_name

def delete_session(db: ORMSession, session_id: uuid.UUID) -> None:
    session = db.execute(
        select(Session).where(Session.id == session_id)
    ).scalar_one_or_none()

    if session is not None:
        db.delete(session)
        db.commit()