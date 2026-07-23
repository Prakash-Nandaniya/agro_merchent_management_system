import uuid
from fastapi import APIRouter, Depends, Request, UploadFile, File
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.trade import CreateTradeSchema, EditTradeSchema, TradeOut
from app.database.crud.trade import (
    save_trade,
    edit_trade,
    get_trade,
)
from app.database.crud.session import get_session_user
from app.services.r2 import (
    upload_bill_to_r2,
    delete_bill_from_r2,
    get_signed_bill_url,
)
from app.core.exceptions import MillReceiptNotFoundError, NotFoundError
from app.services.mill_receipt_to_pdf import convert_to_pdf
from typing import Optional
from fastapi import Form
from app.database.models.trade import Trade

router = APIRouter()


# ── Trade CRUD ──────────────────────────────────────────────────────────────


@router.post("/create-trade", response_model=TradeOut)
async def create_trade_route(
    request: Request,
    payload: CreateTradeSchema = Depends(CreateTradeSchema.as_form),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    session_id = uuid.UUID(request.state.current_user)
    created_by = get_session_user(db, session_id=session_id)

    mill_receipt_key = None
    if file is not None:
        raw_bytes = await file.read()
        pdf_buffer = convert_to_pdf(raw_bytes, file.filename)
        mill_receipt_key = upload_bill_to_r2(pdf_buffer, payload.invoice_no)

    try:
        trade = save_trade(
            db, payload, created_by=created_by, mill_receipt_key=mill_receipt_key
        )
    except Exception:
        if mill_receipt_key:
            delete_bill_from_r2(mill_receipt_key)
        raise

    trades = get_trade(db, {"invoice_no": trade.invoice_no})
    return trades[0]


@router.put("/edit-trade",response_model=TradeOut)
async def edit_trade_route(
    payload: EditTradeSchema = Depends(EditTradeSchema.as_form),
    receipt_edited: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    trades = get_trade(db, {"id": payload.id})
    trade = trades[0]
    old_key = trade.mill_receipt

    new_key = old_key
    if receipt_edited:
        if file is not None:
            raw_bytes = await file.read()
            pdf_buffer = convert_to_pdf(raw_bytes, file.filename)
            new_key = upload_bill_to_r2(pdf_buffer, trade.invoice_no)
        else:
            new_key = None

    try:
        trade = edit_trade(db, payload, mill_receipt_key=new_key)
    except Exception:
        if receipt_edited and new_key:
            delete_bill_from_r2(new_key)
        raise

    if receipt_edited and old_key and old_key != new_key:
        delete_bill_from_r2(old_key)

    trades = get_trade(db, {"id": trade.id})
    return trades[0]


@router.delete("/delete-trade/{trade_id}")
def delete_trade_route(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise NotFoundError(resource="Trade")
    old_key = trade.mill_receipt

    db.delete(trade)
    if old_key:
        try:
            delete_bill_from_r2(old_key)
        except Exception:
            db.rollback()
            raise
    db.commit()
    return {"detail": "Trade deleted successfully"}


from typing import List
from app.schemas.trade import CreateTradeSchema, EditTradeSchema, TradeOut


@router.post("/tradebook", response_model=List[TradeOut])
def tradebook_search(filters: dict, db: Session = Depends(get_db)):
    trades = get_trade(db, filters)
    return trades


# ── Mill receipt (R2-backed) ────────────────────────────────────────────────


@router.get("/get-mill-receipt/{trade_id}")
def get_mill_receipt(trade_id: int, db: Session = Depends(get_db)):
    trades = get_trade(db, {"id": trade_id})
    trade = trades[0]

    if not trade.mill_receipt:
        raise MillReceiptNotFoundError()

    url = get_signed_bill_url(trade.mill_receipt)
    return {"url": url}
