from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.account import Account  
from app.services.security import hash_password, verify_password
from app.core.exceptions import InvalidCredentialsException


async def get_account_by_username(db: AsyncSession, user_name: str) -> Account | None:
    result = await db.execute(select(Account).where(Account.user_name == user_name))
    return result.scalar_one_or_none()


async def authenticate_account(db: AsyncSession, user_name: str, password: str) -> Account:
    account = await get_account_by_username(db, user_name)
    if account is None:
        raise InvalidCredentialsException()

    if not verify_password(password, account.password):
        raise InvalidCredentialsException()

    return account


async def create_account(db: AsyncSession, user_name: str, password: str, **extra_fields) -> Account:
    account = Account(
        user_name=user_name,
        password=hash_password(password),
        **extra_fields,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account