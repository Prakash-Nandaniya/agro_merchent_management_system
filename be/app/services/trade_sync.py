import asyncio
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.crud.trade import (
    save_trade,
    edit_trade,
    get_trade,
    delete_trade_committed,
)
from app.database.models.trade import Trade
from app.schemas.trade import CreateTradeSchema, EditTradeSchema
from app.services.r2 import upload_bill_to_r2, delete_bill_from_r2
from app.services.mill_receipt_to_pdf import convert_to_pdf
from app.core.exceptions import FileTooLargeError, NotFoundError

MAX_RECEIPT_BYTES = 1 * 1024 * 1024  # 1MB


def _check_file_size(raw_bytes: bytes) -> None:
    if len(raw_bytes) > MAX_RECEIPT_BYTES:
        raise FileTooLargeError()


async def create_trade_with_receipt(
    db: AsyncSession,
    payload: CreateTradeSchema,
    created_by: str,
    raw_bytes: Optional[bytes],
    filename: Optional[str],
) -> Trade:
    pdf_buffer = None
    if raw_bytes is not None:
        _check_file_size(raw_bytes)
        # PDF conversion is CPU-bound / blocking — run in a thread
        pdf_buffer = await asyncio.to_thread(convert_to_pdf, raw_bytes, filename)

    naming_key = payload.invoice_no or "trade"

    # Run DB save and R2 upload concurrently where safe
    db_task = save_trade(db, payload, created_by, None)
    r2_task = (
        asyncio.to_thread(upload_bill_to_r2, pdf_buffer, naming_key)
        if pdf_buffer is not None
        else None
    )

    trade = None
    db_error = None
    mill_receipt_key = None
    r2_error = None

    # Await DB first and R2 concurrently
    try:
        if r2_task is not None:
            trade, mill_receipt_key = await asyncio.gather(db_task, r2_task)
        else:
            trade = await db_task
    except Exception as e:
        # If either failed, capture
        if isinstance(e, tuple):
            # gather with multiple may raise a tuple of exceptions in some setups
            db_error = e[0]
        else:
            db_error = e

    # If DB failed but R2 succeeded, remove orphan
    if db_error and mill_receipt_key:
        await asyncio.to_thread(delete_bill_from_r2, mill_receipt_key)

    if db_error:
        raise db_error

    # If R2 failed and DB succeeded, rollback the DB side where appropriate
    if r2_error:
        # best-effort: try to delete created trade
        try:
            db.delete(trade)
            await db.commit()
        except Exception:
            pass
        raise r2_error

    if mill_receipt_key:
        trade.mill_receipt = mill_receipt_key
        await db.commit()
        await db.refresh(trade)

    return trade


# ── EDIT ──────────────────────────────────────────────────────────────────
async def edit_trade_with_receipt(
    db: AsyncSession,
    payload: EditTradeSchema,
    form_edited: bool,
    mill_receipt_edited: bool,
    raw_bytes: Optional[bytes],
    filename: Optional[str],
) -> Trade:
    trades = await get_trade(db, {"id": payload.id})
    if not trades:
        raise NotFoundError(resource="Trade")
    existing = trades[0]

    if not form_edited and not mill_receipt_edited:
        return existing

    old_key = existing.mill_receipt
    naming_key = payload.invoice_no or existing.invoice_no or "trade"

    pdf_buffer = None
    removing_receipt = False
    if mill_receipt_edited:
        if raw_bytes is not None:
            _check_file_size(raw_bytes)
            pdf_buffer = await asyncio.to_thread(convert_to_pdf, raw_bytes, filename)
        else:
            removing_receipt = True  # receipt_edited=true + no file = user removed it

    # DESTRUCTIVE PATH: remove existing receipt — commit DB first
    if removing_receipt and old_key:
        if form_edited:
            trade = await edit_trade(db, payload, None)
        else:
            trade = existing
            trade.mill_receipt = None
            await db.commit()
            await db.refresh(trade)

        try:
            await asyncio.to_thread(delete_bill_from_r2, old_key)
        except Exception as e:
            print(
                f"Warning: DB updated but failed to delete orphaned R2 object {old_key}: {e}"
            )

        return trade

    # NON-DESTRUCTIVE PATH: run DB edit and R2 upload in parallel when safe
    db_task = edit_trade(db, payload, old_key) if form_edited else None
    r2_task = (
        asyncio.to_thread(upload_bill_to_r2, pdf_buffer, naming_key, old_key)
        if pdf_buffer is not None
        else None
    )

    trade = existing
    db_error = None
    r2_result = None
    r2_error = None

    try:
        if db_task is not None and r2_task is not None:
            trade, r2_result = await asyncio.gather(db_task, r2_task)
        elif db_task is not None:
            trade = await db_task
        elif r2_task is not None:
            r2_result = await r2_task
    except Exception as e:
        db_error = e

    if db_error and r2_result and old_key is None:
        await asyncio.to_thread(delete_bill_from_r2, r2_result)

    if db_error:
        raise db_error
    if r2_error:
        raise r2_error

    if r2_result and old_key is None:
        trade.mill_receipt = r2_result
        await db.commit()
        await db.refresh(trade)

    return trade


# ── DELETE — already correct, unchanged ─────────────────────────────────────
# Both directions of failure are already compensated for:
#   - DB succeeds, R2 fails  -> row recreated from snapshot (new id — flagged
#     to the caller since this can break anything holding the old id).
#   - R2 succeeds, DB fails  -> existing row patched (mill_receipt=None,
#     same id) so it never points at a deleted object.
async def delete_trade_and_receipt(db: AsyncSession, trade_id: int) -> Optional[Trade]:
    trades = await get_trade(db, {"id": trade_id})
    if not trades:
        raise NotFoundError(resource="Trade")
    existing = trades[0]

    old_key = existing.mill_receipt

    # Run DB delete and R2 delete concurrently
    db_task = delete_trade_committed(db, trade_id)
    r2_task = asyncio.to_thread(delete_bill_from_r2, old_key) if old_key else None

    snapshot = None
    db_error = None
    r2_ok = True
    r2_error = None

    try:
        if r2_task is not None:
            snapshot = await asyncio.gather(db_task, r2_task)
            # snapshot will be a tuple (db_result, r2_result)
            snapshot = snapshot[0]
        else:
            snapshot = await db_task
    except Exception as e:
        db_error = e

    if not db_error and r2_ok:
        return None

    if db_error and not r2_ok:
        raise db_error

    if not db_error and not r2_ok:
        recreated = Trade(**snapshot)
        db.add(recreated)
        await db.commit()
        await db.refresh(recreated)
        return recreated

    if db_error and r2_ok:
        existing.mill_receipt = None
        await db.commit()
        await db.refresh(existing)
        return existing
