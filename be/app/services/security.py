import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import NotAuthenticatedException

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(session_id: uuid.UUID) -> str:
    """
    Token now carries only the opaque session_id — never the username
    directly. The username is resolved later via a DB lookup against
    the Session table.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=settings.MAX_SESSION_AGE_IN_SECONDS)

    payload = {
        "session_id": str(session_id),  # uuid isn't JSON-serializable directly
        "created_at": now.isoformat(),
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise NotAuthenticatedException("Invalid or expired token")

    if payload.get("session_id") is None:
        raise NotAuthenticatedException("Invalid token payload")

    return payload