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



def get_trade(db: Session, filter: dict) -> List[Trade]:
    query = db.query(Trade)
    if filter:
        for field, value in filter.items():
            if value in (None, "", []):
                continue
            if field.endswith("_from"):
                real_field = field[: -len("_from")]
                column = getattr(Trade, real_field, None)
                if column is not None:
                    query = query.filter(column >= value)
                continue
            if field.endswith("_to"):
                real_field = field[: -len("_to")]
                column = getattr(Trade, real_field, None)
                if column is not None:
                    query = query.filter(column <= value)
                continue
            column = getattr(Trade, field, None)
            if column is None:
                continue
            if field in {"party_name"} and isinstance(value, str):
                query = query.filter(column.ilike(f"%{value}%"))
            else:
                query = query.filter(column == value)
    trades = query.distinct().all()
    if not trades:
        raise NotFoundError(resource="Trade")
    return trades
