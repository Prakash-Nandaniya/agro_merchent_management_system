import uuid
from fastapi import APIRouter, Depends, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.trade import CreateTradeSchema, EditTradeSchema, TradeOut
from app.database.crud.trade import get_trade
from app.database.crud.session import get_session_user
from app.services.r2 import (
    get_signed_bill_url,
)
from app.core.exceptions import MillReceiptNotFoundError
from typing import Optional, List

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
    db: AsyncSession = Depends(get_db),
):
    session_id = uuid.UUID(request.state.current_user)
    created_by = await db.run_sync(get_session_user, session_id=session_id)
    raw_bytes = await file.read() if file is not None else None
    filename = file.filename if file is not None else None
    return await db.run_sync(
        create_trade_with_receipt,
        payload,
        created_by,
        raw_bytes,
        filename,
    )


@router.put("/edit-trade", response_model=TradeOut)
async def edit_trade_route(
    payload: EditTradeSchema = Depends(EditTradeSchema.as_form),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    raw_bytes = await file.read() if file is not None else None
    filename = file.filename if file is not None else None
    return await db.run_sync(
        edit_trade_with_receipt,
        payload,
        payload.form_edited,
        payload.mill_receipt_edited,
        raw_bytes,
        filename,
    )


@router.delete("/delete-trade/{trade_id}", response_model=Optional[TradeOut])
async def delete_trade_route(trade_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.run_sync(delete_trade_and_receipt, trade_id)
    return result


@router.post("/tradebook", response_model=List[TradeOut])
async def tradebook_search(filters: dict, db: AsyncSession = Depends(get_db), page: int = 1):
    return await db.run_sync(get_trade, filters, page=page)


@router.get("/get-mill-receipt/{trade_id}")
async def get_mill_receipt(trade_id: int, db: AsyncSession = Depends(get_db)):
    trades = await db.run_sync(get_trade, {"id": trade_id})
    trade = trades[0]

    if not trade.mill_receipt:
        raise MillReceiptNotFoundError()

    url = get_signed_bill_url(trade.mill_receipt)
    return {"url": url}
