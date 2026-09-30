from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.farmer_purchase import FarmerPurchase, FarmerPurchaseOut, EditFarmerPurchase
from app.database.crud.farmer_purchase import (
    save_farmer_purchase,
    get_farmer_purchase,
    edit_farmer_purchase as edit_farmer_purchase_crud,
)
from app.database.crud.session import get_session_user
from typing import List
import uuid

router = APIRouter()

@router.post("/save-farmer-purchase", response_model=FarmerPurchaseOut)
async def create_farmer_purchase(request: Request, payload: FarmerPurchase, db: AsyncSession = Depends(get_db)):
    session_id = uuid.UUID(request.state.current_user)
    created_by = await get_session_user(db, session_id=session_id)
    purchase = await save_farmer_purchase(db, payload, created_by=created_by)
    return purchase


@router.post("/edit-farmer-purchase", response_model=FarmerPurchaseOut)
async def edit_farmer_purchase(request: Request, payload: EditFarmerPurchase, db: AsyncSession = Depends(get_db)):
    purchase = await edit_farmer_purchase_crud(db, payload)
    return purchase


@router.post("/get-farmer-purchase", response_model=List[FarmerPurchaseOut])
async def get_farmer_purchase_records(filter: dict, db: AsyncSession = Depends(get_db), page: int = 1):
    return await get_farmer_purchase(db, filter, page)
