import concurrent.futures
from typing import Optional
from sqlalchemy.orm import Session

from app.database.crud.trade import save_trade, edit_trade, get_trade, delete_trade_committed
from app.database.models.trade import Trade
from app.schemas.trade import CreateTradeSchema, EditTradeSchema
from app.services.r2 import upload_bill_to_r2, delete_bill_from_r2
from app.services.mill_receipt_to_pdf import convert_to_pdf
from app.core.exceptions import FileTooLargeError, NotFoundError

MAX_RECEIPT_BYTES = 1 * 1024 * 1024  # 1MB


def _check_file_size(raw_bytes: bytes) -> None:
    if len(raw_bytes) > MAX_RECEIPT_BYTES:
        raise FileTooLargeError()


# ── CREATE ────────────────────────────────────────────────────────────────
def create_trade_with_receipt(
    db: Session,
    payload: CreateTradeSchema,
    created_by: str,
    raw_bytes: Optional[bytes],
    filename: Optional[str],
) -> Trade:
    pdf_buffer = None
    if raw_bytes is not None:
        _check_file_size(raw_bytes)
        pdf_buffer = convert_to_pdf(raw_bytes, filename)

    naming_key = payload.invoice_no or "trade"

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        db_future = executor.submit(save_trade, db, payload, created_by, None)
        r2_future = (
            executor.submit(upload_bill_to_r2, pdf_buffer, naming_key)
            if pdf_buffer is not None else None
        )

        trade, db_error = None, None
        try:
            trade = db_future.result()
        except Exception as e:
            db_error = e

        mill_receipt_key, r2_error = None, None
        if r2_future is not None:
            try:
                mill_receipt_key = r2_future.result()
            except Exception as e:
                r2_error = e

    # ── Compensate ────────────────────────────────────────────────────────
    if db_error and mill_receipt_key:
        delete_bill_from_r2(mill_receipt_key)
    if r2_error and trade:
        db.delete(trade)
        db.commit()

    if db_error:
        raise db_error
    if r2_error:
        raise r2_error

    if mill_receipt_key:
        trade.mill_receipt = mill_receipt_key
        db.commit()
        db.refresh(trade)

    return trade


# ── EDIT ──────────────────────────────────────────────────────────────────
def edit_trade_with_receipt(
    db: Session,
    payload: EditTradeSchema,
    form_edited: bool,
    mill_receipt_edited: bool,
    raw_bytes: Optional[bytes],
    filename: Optional[str],
) -> Trade:
    existing = get_trade(db, {"id": payload.id})[0]

    # ── Nothing to do at all — avoids every redundant call ──────────────────
    if not form_edited and not mill_receipt_edited:
        return existing

    old_key = existing.mill_receipt
    naming_key = payload.invoice_no or existing.invoice_no or "trade"

    pdf_buffer = None
    removing_receipt = False
    if mill_receipt_edited:
        if raw_bytes is not None:
            _check_file_size(raw_bytes)
            pdf_buffer = convert_to_pdf(raw_bytes, filename)
        else:
            removing_receipt = True  # receipt_edited=true + no file = user removed it

    # Only submit the work that's actually needed — this is the
    # "don't make redundant calls" part.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        db_future = executor.submit(edit_trade, db, payload, old_key) if form_edited else None

        r2_future = None
        if pdf_buffer is not None:
            # Replace-in-place if a key already exists (no delete needed —
            # PUT is atomic, old content survives on failure). Only mint a
            # brand-new key if this trade never had a receipt before.
            r2_future = executor.submit(upload_bill_to_r2, pdf_buffer, naming_key, old_key)
        elif removing_receipt and old_key:
            r2_future = executor.submit(delete_bill_from_r2, old_key)

        trade, db_error = existing, None
        if db_future is not None:
            try:
                trade = db_future.result()
            except Exception as e:
                db_error = e

        r2_result, r2_error = None, None
        if r2_future is not None:
            try:
                r2_result = r2_future.result()
            except Exception as e:
                r2_error = e

    if db_error and r2_result and old_key is None:
        delete_bill_from_r2(r2_result)

    if db_error:
        raise db_error
    if r2_error:
        raise r2_error

    if removing_receipt:
        trade.mill_receipt = None
        db.commit()
        db.refresh(trade)
    elif r2_result and old_key is None:
        trade.mill_receipt = r2_result
        db.commit()
        db.refresh(trade)

    return trade


# ── DELETE — now genuinely parallel, with saga-style compensation ──────────
def delete_trade_and_receipt(db: Session, trade_id: int) -> Optional[Trade]:
    """
    Runs the DB delete+commit and the R2 delete AT THE SAME TIME. Afterwards:
      - both succeeded            -> fully deleted, returns None
      - DB succeeded, R2 failed   -> file is orphaned in R2; recreate the row
                                      from its snapshot so nothing points to
                                      a ghost object. NOTE: the recreated row
                                      gets a NEW id (autoincrement can't be
                                      reused) — this is the "new things"
                                      you flagged; the frontend must re-sync
                                      against the returned trade's new id.
      - R2 succeeded, DB failed   -> row still exists (transaction rolled
                                      back) but now points at a deleted R2
                                      object. Patch mill_receipt to None on
                                      the still-existing row and return it —
                                      same id, but mill_receipt has changed.
      - both failed               -> nothing happened, re-raise.
    """
    trades = get_trade(db, {"id": trade_id})
    if not trades:
        raise NotFoundError(resource="Trade")
    existing = trades[0]
    
    old_key = existing.mill_receipt

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        db_future = executor.submit(delete_trade_committed, db, trade_id)
        r2_future = executor.submit(delete_bill_from_r2, old_key) if old_key else None

        snapshot, db_error = None, None
        try:
            snapshot = db_future.result()
        except Exception as e:
            db_error = e

        r2_ok, r2_error = (True, None) if old_key is None else (None, None)
        if r2_future is not None:
            try:
                r2_future.result()
                r2_ok = True
            except Exception as e:
                r2_error = e
                r2_ok = False

    # ── Both succeeded — fully gone ──────────────────────────────────────
    if not db_error and r2_ok:
        return None

    # ── Both failed — nothing changed, nothing to compensate ─────────────
    if db_error and not r2_ok:
        raise db_error

    # ── DB succeeded, R2 failed: recreate the row from its snapshot ──────
    if not db_error and not r2_ok:
        recreated = Trade(**snapshot)  # new autoincrement id — flagged above
        db.add(recreated)
        db.commit()
        db.refresh(recreated)
        return recreated

    # ── R2 succeeded, DB failed: row still exists, null out the dead key ──
    if db_error and r2_ok:
        existing.mill_receipt = None
        db.commit()
        db.refresh(existing)
        return existing