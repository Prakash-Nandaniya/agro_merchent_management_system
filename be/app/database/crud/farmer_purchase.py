import re
from typing import List
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    translate_integrity_error,
    NotFoundError,
    DatabaseOperationException,
)
from app.database.models.farmer_purchase import FarmerPurchase
from app.database.models.account import Account
from app.schemas.farmer_purchase import FarmerPurchase as FarmerPurchaseSchema
from app.schemas.farmer_purchase import EditFarmerPurchase as EditFarmerPurchaseSchema
from sqlalchemy import select
from datetime import date, datetime


def _default_farmer_invoice_prefix() -> str:
    year = date.today().year
    return f"KT/SI/{year}-{str(year + 1)[2:]}/"


def increment_invoice_number(last_invoice_no: str | None) -> str:
    if last_invoice_no is None or str(last_invoice_no).strip() in {"", "0"}:
        return f"{_default_farmer_invoice_prefix()}0001"

    normalized = str(last_invoice_no).strip()
    match = re.search(r"(\d+)$", normalized)
    if match is None:
        prefix = normalized.rstrip("/")
        return f"{prefix}/{1:04d}" if prefix else f"{1:04d}"

    prefix = normalized[: match.start(1)]
    current_number = int(match.group(1))
    width = len(match.group(1))
    next_number = current_number + 1
    return f"{prefix}{next_number:0{width}d}"


async def save_farmer_purchase(db: AsyncSession, payload: FarmerPurchaseSchema, created_by: str) -> FarmerPurchase:
    try:
        res = await db.execute(select(Account).with_for_update())
        account = res.scalar_one_or_none()
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e

    if account is None:
        await db.rollback()
        raise NotFoundError(resource="Account")

    counter_field = (
        "rcm_purchase_bill_last_invoice_no"
        if payload.document_type == "RCM Purchase Bill"
        else "purchase_bill_last_invoice_no"
    )
    raw_voucher_no = payload.voucher_no
    if not raw_voucher_no or not raw_voucher_no.strip():
        new_voucher_no = increment_invoice_number(getattr(account, counter_field, None) or "0")
    else:
        new_voucher_no = raw_voucher_no.strip()

    data = payload.to_orm_kwargs()
    data["voucher_no"] = new_voucher_no
    data["created_by"] = created_by.upper()

    purchase = FarmerPurchase(**data)
    setattr(account, counter_field, new_voucher_no)

    db.add(purchase)
    db.add(account)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e

    await db.refresh(purchase)
    return purchase


async def edit_farmer_purchase(db: AsyncSession, payload: EditFarmerPurchaseSchema) -> FarmerPurchase:
    res = await db.execute(select(FarmerPurchase).where(FarmerPurchase.voucher_no == payload.voucher_no))
    purchase = res.scalar_one_or_none()
    if purchase is None:
        raise NotFoundError(resource="FarmerPurchase", identifier=payload.voucher_no)

    data = payload.to_orm_kwargs()
    data.pop("voucher_no", None)
    for field, value in data.items():
        setattr(purchase, field, value)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e

    await db.refresh(purchase)
    return purchase


async def get_farmer_purchase(db: AsyncSession, filter: dict, page: int) -> List[FarmerPurchase]:
    stmt = select(FarmerPurchase)
    if filter:
        for field, value in filter.items():
            if value in (None, "", []):
                continue
            if field.endswith("_from"):
                real_field = field[: -len("_from")]
                column = getattr(FarmerPurchase, real_field, None)
                if column is not None:
                    parsed = value
                    if isinstance(value, str):
                        try:
                            parsed_dt = datetime.fromisoformat(value)
                            parsed = parsed_dt.date() if isinstance(parsed_dt, datetime) else parsed_dt
                        except Exception:
                            try:
                                parsed = datetime.strptime(value, "%d-%m-%Y").date()
                            except Exception:
                                parsed = value
                    stmt = stmt.where(column >= parsed)
                continue
            if field.endswith("_to"):
                real_field = field[: -len("_to")]
                column = getattr(FarmerPurchase, real_field, None)
                if column is not None:
                    parsed = value
                    if isinstance(value, str):
                        try:
                            parsed_dt = datetime.fromisoformat(value)
                            parsed = parsed_dt.date() if isinstance(parsed_dt, datetime) else parsed_dt
                        except Exception:
                            try:
                                parsed = datetime.strptime(value, "%d-%m-%Y").date()
                            except Exception:
                                parsed = value
                    stmt = stmt.where(column <= parsed)
                continue
            column = getattr(FarmerPurchase, field, None)
            if column is None:
                continue
            if field in {"farmer_name", "merchant_name", "farmer_address", "merchant_address"} and isinstance(value, str):
                stmt = stmt.where(column.ilike(f"%{value}%"))
            else:
                stmt = stmt.where(column == value)

    stmt = stmt.order_by(FarmerPurchase.created_at.desc()).offset(500 * (page - 1)).limit(500)
    res = await db.execute(stmt)
    purchases = res.scalars().all()
    return purchases