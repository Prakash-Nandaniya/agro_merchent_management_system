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
from math import ceil
from app.core.config import settings

PAGE_SIZE = settings.BE_PAGE_SIZE

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


def get_trade(db: Session, filters: dict, page: int = 1) -> List[Trade]:
    query = db.query(Trade)  

    if filters:
        for field, value in filters.items():
            if value in (None, "", []):
                continue
            if field == "date_from":
                query = query.filter(Trade.trade_creation_date >= value)
                continue
            if field == "date_to":
                query = query.filter(Trade.trade_creation_date <= value)
                continue

            column = getattr(Trade, field, None)
            if column is None:
                continue

            if field in {"party_name", "party_city", "crop_name"} and isinstance(value, str):
                query = query.filter(column.ilike(f"%{value}%"))
            else:
                query = query.filter(column == value)

    query = query.order_by(Trade.updated_at.desc())

    page = max(1, page)
    offset = (page - 1) * PAGE_SIZE
    trades = query.offset(offset).limit(PAGE_SIZE).all()

    if not trades:
        raise NotFoundError(resource="Trade")
    return trades

def delete_trade_committed(db: Session, trade_id: int) -> dict:
    """
    Deletes AND commits immediately, returning a snapshot of the row's data
    (everything except id/created_at/updated_at) so the caller can recreate
    it if the R2 side of the saga fails. Used only by the parallel delete
    flow in trade_sync.py — never call this directly from a route.
    """
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise NotFoundError(resource="Trade")

    snapshot = {
        c.name: getattr(trade, c.name)
        for c in Trade.__table__.columns
        if c.name not in ("id", "created_at", "updated_at")
    }

    db.delete(trade)
    try:
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise DatabaseOperationException() from e

    return snapshot