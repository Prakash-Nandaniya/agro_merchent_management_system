from fastapi import APIRouter, Depends, Response, Request
from sqlalchemy.orm import Session as ORMSession
from app.schemas.user import LoginRequest
from app.database.session import get_db
from app.database.crud.account import authenticate_account
from app.database.crud.session import create_session, delete_session
from app.services.security import create_access_token, decode_access_token
from app.core.config import settings

router = APIRouter()

COOKIE_NAME = "access_token"


@router.post("/login")
async def login_user(
    payload: LoginRequest,
    response: Response,
    db: ORMSession = Depends(get_db),
):
    account = authenticate_account(db, payload.user_name, payload.password)

    # session_user_name is the person's entered NAME, not the account username —
    # this is what gets resolved later as `created_by` on bills.
    session = create_session(db, user_name=payload.current_session_user_name)
    token = create_access_token(session_id=session.id)

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.MAX_SESSION_AGE_IN_SECONDS,
        path="/",
    )

    return {"detail": "Login successful", "current_session_user_name": payload.current_session_user_name}


@router.post("/logout")
async def logout_user(
    request: Request,
    response: Response,
    db: ORMSession = Depends(get_db),
):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        try:
            payload = decode_access_token(token)
            delete_session(db, session_id=payload["session_id"])
        except Exception:
            pass

    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"detail": "Logout successful"}