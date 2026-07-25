import uuid
from fastapi import APIRouter, Depends, Request, UploadFile, File
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.trade import CreateTradeSchema, EditTradeSchema, TradeOut
from app.database.crud.trade import (get_trade)
from app.database.crud.session import get_session_user
from app.services.r2 import (
    get_signed_bill_url,
)
from app.core.exceptions import MillReceiptNotFoundError
from typing import Optional,List

router = APIRouter()
from app.services.trade_sync import (
    create_trade_with_receipt,
    edit_trade_with_receipt,
    delete_trade_and_receipt,
)

@router.post("/create-trade", response_model=TradeOut)
async def create_trade_route(
    request: Request,
    payload: CreateTradeSchema = Depends(CreateTradeSchema.as_form),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    session_id = uuid.UUID(request.state.current_user)
    created_by = get_session_user(db, session_id=session_id)
    raw_bytes = await file.read() if file is not None else None
    filename = file.filename if file is not None else None
    return create_trade_with_receipt(db, payload, created_by, raw_bytes, filename)


@router.put("/edit-trade", response_model=TradeOut)
async def edit_trade_route(
    payload: EditTradeSchema = Depends(EditTradeSchema.as_form),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read() if file is not None else None
    filename = file.filename if file is not None else None
    return edit_trade_with_receipt(
        db,
        payload,
        payload.form_edited,
        payload.mill_receipt_edited,
        raw_bytes,
        filename,
    )


@router.delete("/delete-trade/{trade_id}", response_model=Optional[TradeOut])
def delete_trade_route(trade_id: int, db: Session = Depends(get_db)):
    result = delete_trade_and_receipt(db, trade_id)
    return result


@router.post("/tradebook/{page}", response_model=List[TradeOut])
def tradebook_search(page: int, filters: dict, db: Session = Depends(get_db)):
    return get_trade(db, filters, page=page)


@router.get("/get-mill-receipt/{trade_id}")
def get_mill_receipt(trade_id: int, db: Session = Depends(get_db)):
    trades = get_trade(db, {"id": trade_id})
    trade = trades[0]

    if not trade.mill_receipt:
        raise MillReceiptNotFoundError()

    url = get_signed_bill_url(trade.mill_receipt)
    return {"url": url}