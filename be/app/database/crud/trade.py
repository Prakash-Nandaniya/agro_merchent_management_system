import uuid
from typing import List, Optional
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from app.core.exceptions import (
    translate_integrity_error,
    NotFoundError,
    DatabaseOperationException,
)
from app.database.models.trade import Trade
from app.schemas.trade import CreateTradeSchema, EditTradeSchema
from sqlalchemy.orm import contains_eager
from app.database.models.mill import MillBill, BillCrop

def save_trade(
    db: Session,
    payload: CreateTradeSchema,
    created_by: str,
    mill_receipt_key: Optional[str],
) -> Trade:
    data = payload.to_orm_kwargs()
    trade = Trade(
        **data["bill"],
        mill_receipt=mill_receipt_key,
        created_by=created_by.upper(),
    )
    db.add(trade)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        db.rollback()
        raise DatabaseOperationException() from e
    db.refresh(trade)
    return trade


def edit_trade(
    db: Session, payload: EditTradeSchema, mill_receipt_key: Optional[str]
) -> Trade:
    trade = db.query(Trade).filter(Trade.id == payload.id).first()
    if not trade:
        raise NotFoundError(resource="Trade")

    data = payload.to_orm_kwargs()
    for field, value in data["bill"].items():
        setattr(trade, field, value)
    trade.mill_receipt = mill_receipt_key

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        db.rollback()
        raise DatabaseOperationException() from e
    db.refresh(trade)
    return trade


def get_trade(db: Session, filters: dict) -> List[Trade]:
    query = (
        db.query(Trade)
        .join(Trade.invoice)  # single join — invoice_no is NOT NULL, always matches
        .options(contains_eager(Trade.invoice).selectinload(MillBill.crops))
    )

    if filters:
        if filters.get("crop"):
            query = query.join(MillBill.crops).filter(
                BillCrop.crop.ilike(f"%{filters['crop']}%")
            )

        for field, value in filters.items():
            if field == "crop" or value in (None, "", []):
                continue
            if field == "date_from":
                query = query.filter(Trade.trade_creation_date >= value)
                continue
            if field == "date_to":
                query = query.filter(Trade.trade_creation_date <= value)
                continue

            column = getattr(Trade, field, None) or getattr(MillBill, field, None)
            if column is None:
                continue

            if field in {"party_name", "party_city", "seller_name"} and isinstance(value, str):
                query = query.filter(column.ilike(f"%{value}%"))
            else:
                query = query.filter(column == value)

    trades = query.distinct().all()
    if not trades:
        raise NotFoundError(resource="Trade")
    return trades
