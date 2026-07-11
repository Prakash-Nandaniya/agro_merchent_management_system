from typing import List
from sqlalchemy.exc import IntegrityError,SQLAlchemyError
from sqlalchemy.orm import Session, joinedload
from app.core.exceptions import translate_integrity_error, NotFoundError, DatabaseOperationException
from app.database.models.mill import MillBill, BillCrop
from app.schemas.mill_bill import MillBill as MillBillSchema  # ← alias avoids colliding with the ORM MillBill above
from sqlalchemy import select
from app.database.models.account import Account  


def save_mill_bill(db: Session, payload: MillBillSchema, created_by: str) -> MillBill:
    try:
        account = db.execute(
            select(Account)
            .where(Account.user_name == created_by)  
            .with_for_update()
        ).scalar_one_or_none()
    except SQLAlchemyError as e:
        db.rollback()
        raise DatabaseOperationException() from e

    if account is None:
        db.rollback()
        raise NotFoundError(resource="Account")

    new_invoice_no = int(account.last_millbill_invoiceNo)+1
    data = payload.to_orm_kwargs()
    mill_bill = MillBill(
        **data["bill"],
        created_by=created_by,
        invoice_no=new_invoice_no,  
    )
    mill_bill.crops = [BillCrop(**row) for row in data["crops"]]

    account.last_millbill_invoiceNo = new_invoice_no

    db.add(mill_bill)
    db.add(account)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        db.rollback()
        raise DatabaseOperationException() from e

    db.refresh(mill_bill)
    return mill_bill


def get_mill_bill(db: Session, filter: dict) -> List[MillBill]:
    query = db.query(MillBill).options(joinedload(MillBill.crops))
    if filter:
        for field, value in filter.items():
            if value in (None, "", []):
                continue
            if field.endswith("_from"):
                real_field = field[: -len("_from")]
                column = getattr(MillBill, real_field, None)
                if column is not None:
                    query = query.filter(column >= value)
                continue
            if field.endswith("_to"):
                real_field = field[: -len("_to")]
                column = getattr(MillBill, real_field, None)
                if column is not None:
                    query = query.filter(column <= value)
                continue
            column = getattr(MillBill, field, None)
            if column is None:
                continue
            if field in {"party_name", "seller_name", "party_address", "seller_address"} and isinstance(value, str):
                query = query.filter(column.ilike(f"%{value}%"))
            else:
                query = query.filter(column == value)
    bills = query.distinct().all()
    if not bills:
        raise NotFoundError(resource="MillBill")
    return bills