import uuid
from sqlalchemy.orm import Session
from app.database.models.account import Account
from app.schemas.profile_configuration import ProfileConfigSchema

def get_configuration(db: Session) -> ProfileConfigSchema | None:
    account = db.query(Account).first()
    return account.configuration if account else None


def update_configuration(db: Session, config_data: dict) -> ProfileConfigSchema | None:
    account = db.query(Account).first()
    if not account:
        return None

    account.configuration = config_data
    db.commit()
    db.refresh(account)
    return account.configuration