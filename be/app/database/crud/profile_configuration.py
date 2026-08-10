import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.models.account import Account
from app.schemas.profile_configuration import ProfileConfigSchema


async def get_configuration(db: AsyncSession) -> dict | None:
    res = await db.execute(select(Account))
    account = res.scalars().first()

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


async def update_configuration(db: AsyncSession, config_data: dict) -> ProfileConfigSchema | None:
    res = await db.execute(select(Account))
    account = res.scalars().first()
    if not account:
        return None
    account.configuration = config_data.model_dump()
    await db.commit()
    await db.refresh(account)
    return account.configuration
