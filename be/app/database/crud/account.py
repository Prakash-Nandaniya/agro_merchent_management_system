from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models.account import Account
from app.services.security import hash_password, verify_password
from app.core.exceptions import InvalidCredentialsException


def get_account_by_username(db: Session, user_name: str) -> Account | None:
    result = db.execute(select(Account).where(Account.user_name == user_name))
    return result.scalar_one_or_none()


def authenticate_account(db: Session, user_name: str, password: str) -> Account:
    account = get_account_by_username(db, user_name)
    if account is None:
        raise InvalidCredentialsException()

    if not verify_password(password, account.password):
        raise InvalidCredentialsException()

    return account


def create_account(
    db: Session, user_name: str, password: str, **extra_fields
) -> Account:
    account = Account(
        user_name=user_name,
        password=hash_password(password),
        **extra_fields,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account
