from typing import List
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
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
from app.database.models.account import Account
from app.core.config import settings


def save_invoice(db: Session, payload: InvoiceSchema, created_by: str) -> Invoice:
    try:
        account = db.execute(select(Account).with_for_update()).scalar_one_or_none()
    except SQLAlchemyError as e:
        db.rollback()
        raise DatabaseOperationException() from e

    if account is None:
        db.rollback()
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
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        db.rollback()
        raise DatabaseOperationException() from e

    db.refresh(invoice)
    return invoice

def edit_invoice(db: Session, payload: EditInvoiceSchema) -> Invoice:
    invoice = (
        db.query(Invoice)
        .filter(Invoice.invoice_no == payload.invoice_no)
        .first()
    )
    if invoice is None:
        raise InvoiceNotFoundException(payload.invoice_no)

    data = payload.to_orm_kwargs()
    # invoice_no is the lookup key, not a column to overwrite
    data.pop("invoice_no", None)

    for field, value in data.items():
        setattr(invoice, field, value)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        db.rollback()
        raise DatabaseOperationException() from e

    db.refresh(invoice)
    return invoice

def get_invoice(db: Session, filter: dict, page: int) -> List[Invoice]:
    base_query = db.query(Invoice.id)
    if filter:
        for field, value in filter.items():
            if value in (None, "", []):
                continue
            if field.endswith("_from"):
                real_field = field[: -len("_from")]
                column = getattr(Invoice, real_field, None)
                if column is not None:
                    base_query = base_query.filter(column >= value)
                continue
            if field.endswith("_to"):
                real_field = field[: -len("_to")]
                column = getattr(Invoice, real_field, None)
                if column is not None:
                    base_query = base_query.filter(column <= value)
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
                base_query = base_query.filter(column.ilike(f"%{value}%"))
            else:
                base_query = base_query.filter(column == value)

    paged_ids = (
        base_query.order_by(Invoice.created_at.desc())
        .offset(500 * (page - 1))
        .limit(500)
        .subquery()
    )

    bills = (
        db.query(Invoice)
        .filter(Invoice.id.in_(db.query(paged_ids)))
        .order_by(Invoice.created_at.desc())
        .all()
    )

    return bills