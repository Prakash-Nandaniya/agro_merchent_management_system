import uuid
from sqlalchemy.orm import Session
from app.database.models.account import Account
from app.schemas.profile_configuration import ProfileConfigSchema


def get_configuration(db: Session) -> dict | None:
    account = db.query(Account).first()

    if not account:
        return {
            "seller": {"name": "", "address": "", "pan": "", "gstin": ""},
            "bank_accounts": [],
            "crops": {},
            "terms_and_conditions": "As per provided in the Quotation and Order Form.",
            "last_millbill_invoiceNo": "0",
        }

    config = account.configuration if isinstance(account.configuration, dict) else {}
    config["last_millbill_invoiceNo"] = account.last_millbill_invoiceNo
    return config


def update_configuration(db: Session, config_data: dict) -> ProfileConfigSchema | None:
    account = db.query(Account).first()
    if not account:
        return None
    account.configuration = config_data.model_dump()
    db.commit()
    db.refresh(account)
    return account.configuration
