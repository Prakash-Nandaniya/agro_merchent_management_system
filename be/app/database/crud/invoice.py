from typing import List
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    translate_integrity_error,
    NotFoundError,
    DatabaseOperationException,
    InvoiceNotFoundException,
)
from app.database.models.invoice import Invoice
from app.schemas.invoice import (
    Invoice as InvoiceSchema,
) 
from app.schemas.invoice import (
    EditInvoice as EditInvoiceSchema,
) 
from sqlalchemy import select
from datetime import datetime, date as datecls
from app.database.models.account import Account
from app.core.config import settings


async def save_invoice(db: AsyncSession, payload: InvoiceSchema, created_by: str) -> Invoice:
    try:
        res = await db.execute(select(Account).with_for_update())
        account = res.scalar_one_or_none()
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e

    if account is None:
        await db.rollback()
        raise NotFoundError(resource="Account")

    raw_invoice = payload.invoice_no
    if not raw_invoice or not raw_invoice.strip():
        new_invoice_no = str(int(account.last_millbill_invoiceNo) + 1)
    else:
        new_invoice_no = raw_invoice.strip()

    data = payload.to_orm_kwargs()
    data["invoice_no"] = new_invoice_no
    data["created_by"] = created_by.upper()

    invoice = Invoice(**data)

    account.last_millbill_invoiceNo = new_invoice_no

    db.add(invoice)
    db.add(account)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e

    await db.refresh(invoice)
    return invoice


async def edit_invoice(db: AsyncSession, payload: EditInvoiceSchema) -> Invoice:
    res = await db.execute(select(Invoice).where(Invoice.invoice_no == payload.invoice_no))
    invoice = res.scalar_one_or_none()
    if invoice is None:
        raise InvoiceNotFoundException(payload.invoice_no)

    data = payload.to_orm_kwargs()
    data.pop("invoice_no", None)

    for field, value in data.items():
        setattr(invoice, field, value)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e

    await db.refresh(invoice)
    return invoice


async def get_invoice(db: AsyncSession, filter: dict, page: int) -> List[Invoice]:
    stmt = select(Invoice)
    if filter:
        for field, value in filter.items():
            if value in (None, "", []):
                continue
            if field.endswith("_from"):
                real_field = field[: -len("_from")]
                column = getattr(Invoice, real_field, None)
                if column is not None:
                    # If the column is a date/datetime and the incoming value is a string,
                    # coerce it to a date object so asyncpg receives the correct type
                    parsed = value
                    if isinstance(value, str):
                        try:
                            # try ISO format first
                            parsed_dt = datetime.fromisoformat(value)
                            parsed = parsed_dt.date() if isinstance(parsed_dt, datetime) else parsed_dt
                        except Exception:
                            try:
                                # try common dd-mm-YYYY
                                parsed = datetime.strptime(value, "%d-%m-%Y").date()
                            except Exception:
                                parsed = value
                    stmt = stmt.where(column >= parsed)
                continue
            if field.endswith("_to"):
                real_field = field[: -len("_to")]
                column = getattr(Invoice, real_field, None)
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
            column = getattr(Invoice, field, None)
            if column is None:
                continue
            if field in {
                "party_name",
                "seller_name",
                "party_address",
                "seller_address",
            } and isinstance(value, str):
                stmt = stmt.where(column.ilike(f"%{value}%"))
            else:
                stmt = stmt.where(column == value)

    stmt = stmt.order_by(Invoice.created_at.desc()).offset(500 * (page - 1)).limit(500)
    res = await db.execute(stmt)
    bills = res.scalars().all()
    return bills