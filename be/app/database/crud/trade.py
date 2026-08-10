from typing import List, Optional
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    translate_integrity_error,
    NotFoundError,
    DatabaseOperationException,
)
from app.database.models.trade import Trade
from app.schemas.trade import CreateTradeSchema, EditTradeSchema
from math import ceil
from app.core.config import settings
from sqlalchemy import select
from datetime import datetime

PAGE_SIZE = settings.BE_PAGE_SIZE


async def save_trade(
    db: AsyncSession,
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
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e
    await db.refresh(trade)
    return trade


async def edit_trade(
    db: AsyncSession, payload: EditTradeSchema, mill_receipt_key: Optional[str]
) -> Trade:
    res = await db.execute(select(Trade).where(Trade.id == payload.id))
    trade = res.scalar_one_or_none()
    if not trade:
        raise NotFoundError(resource="Trade")

    data = payload.to_orm_kwargs()
    for field, value in data["bill"].items():
        setattr(trade, field, value)
    trade.mill_receipt = mill_receipt_key

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise translate_integrity_error(e)
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e
    await db.refresh(trade)
    return trade


async def get_trade(db: AsyncSession, filters: dict, page: Optional[int] = None) -> List[Trade]:
    stmt = select(Trade)

    if filters:
        for field, value in filters.items():
            if value in (None, "", []):
                continue
            if field == "date_from":
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
                stmt = stmt.where(Trade.trade_creation_date >= parsed)
                continue
            if field == "date_to":
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
                stmt = stmt.where(Trade.trade_creation_date <= parsed)
                continue

            column = getattr(Trade, field, None)
            if column is None:
                continue

            if field in {"party_name", "party_city", "crop_name"} and isinstance(value, str):
                stmt = stmt.where(column.ilike(f"%{value}%"))
            else:
                stmt = stmt.where(column == value)

    stmt = stmt.order_by(Trade.updated_at.desc())

    if page is not None and page > 0:
        stmt = stmt.offset(PAGE_SIZE * (page - 1)).limit(PAGE_SIZE)

    res = await db.execute(stmt)
    return res.scalars().all()


async def delete_trade_committed(db: AsyncSession, trade_id: int) -> dict:
    """
    Deletes AND commits immediately, returning a snapshot of the row's data
    (everything except id/created_at/updated_at) so the caller can recreate
    it if the R2 side of the saga fails. Used only by the parallel delete
    flow in trade_sync.py — never call this directly from a route.
    """
    res = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = res.scalar_one_or_none()
    if not trade:
        raise NotFoundError(resource="Trade")

    snapshot = {
        c.name: getattr(trade, c.name)
        for c in Trade.__table__.columns
        if c.name not in ("id", "created_at", "updated_at")
    }

    db.delete(trade)
    try:
        await db.commit()
    except SQLAlchemyError as e:
        await db.rollback()
        raise DatabaseOperationException() from e

    return snapshot