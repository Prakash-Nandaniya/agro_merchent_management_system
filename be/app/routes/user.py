from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db  
from app.database.crud.account import authenticate_account
from app.services.security import create_access_token
from app.core.config import settings
router = APIRouter()

COOKIE_NAME = "access_token"


class LoginRequest(BaseModel):
    user_name: str
    password: str


@router.post("/login")
async def login_user(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    account = await authenticate_account(db, payload.user_name, payload.password)

    token = create_access_token(current_user=account.user_name)

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,      
        secure=True,        
        samesite="lax",    
        max_age=settings.MAX_SESSION_AGE_IN_SECONDS,    
        path="/",
    )

    return {"detail": "Login successful", "user_name": account.user_name}


@router.post("/logout")
async def logout_user(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"detail": "Logout successful"}