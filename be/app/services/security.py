import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings  
from app.core.exceptions import NotAuthenticatedException
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(current_user: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=settings.MAX_SESSION_AGE_IN_SECONDS)

    payload = {
        "current_user": current_user,
        "created_at": now.isoformat(),
        "exp": expire,
        "jti": str(uuid.uuid4()), 
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise NotAuthenticatedException("Invalid or expired token")

    if payload.get("current_user") is None:
        raise NotAuthenticatedException("Invalid token payload")

    return payload