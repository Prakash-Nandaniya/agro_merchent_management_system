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
            "farmer_bill_terms": "As per provided in the Quotation and Order Form.",
            "millbill_last_invoiceNo": "0",
            "purchase_bill_last_invoiceNo": "0",
            "rcm_purchase_bill_last_invoiceNo": "0",
        }

    config = account.configuration if isinstance(account.configuration, dict) else {}
    config.setdefault("terms_and_conditions", "As per provided in the Quotation and Order Form.")
    config.setdefault("farmer_bill_terms", config.get("terms_and_conditions") or "As per provided in the Quotation and Order Form.")
    config["millbill_last_invoiceNo"] = account.millbill_last_invoice_no or "0"
    config["purchase_bill_last_invoiceNo"] = (
        config.get("purchase_bill_last_invoiceNo")
        or getattr(account, "purchase_bill_last_invoice_no", None)
        or "0"
    )
    config["rcm_purchase_bill_last_invoiceNo"] = (
        config.get("rcm_purchase_bill_last_invoiceNo")
        or getattr(account, "rcm_purchase_bill_last_invoice_no", None)
        or "0"
    )
    return config


async def update_configuration(db: AsyncSession, config_data: dict) -> ProfileConfigSchema | None:
    res = await db.execute(select(Account))
    account = res.scalars().first()
    if not account:
        return None

    payload = config_data.model_dump()
    account.configuration = payload

    if payload.get("millbill_last_invoiceNo") is not None:
        account.millbill_last_invoice_no = str(payload["millbill_last_invoiceNo"])
    if payload.get("purchase_bill_last_invoiceNo") is not None:
        account.purchase_bill_last_invoice_no = str(payload["purchase_bill_last_invoiceNo"])
    if payload.get("rcm_purchase_bill_last_invoiceNo") is not None:
        account.rcm_purchase_bill_last_invoice_no = str(payload["rcm_purchase_bill_last_invoiceNo"])

    await db.commit()
    await db.refresh(account)
    return account.configuration
