from typing import List
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import translate_integrity_error, NotFoundError
from app.database.models.mill import MillBill, BillCrop


def save_mill_bill(db: Session, payload: MillBill) -> MillBill:
    data = payload.to_orm_kwargs()
    mill_bill = MillBill(**data["bill"])
    mill_bill.crops = [BillCrop(**row) for row in data["crops"]]
    db.add(mill_bill)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise translate_integrity_error(e)
    db.refresh(mill_bill)
    return mill_bill


def get_mill_bill(db: Session, filter: dict) -> List[MillBill]:
    """
    Returns MillBill rows (with crops eager-loaded) matching `filter`.
    If filter is empty -> return everything.
    Raises MillBillNotFoundError if nothing matches (router no longer needs
    to check this).
    """
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