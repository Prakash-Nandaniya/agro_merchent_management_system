from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.invoice import Invoice, InvoiceOut, EditInvoice
from app.database.crud.invoice import save_invoice, get_invoice, edit_invoice as edit_invoice_crud
from app.database.crud.session import get_session_user
from typing import List
import uuid

router = APIRouter()

@router.post("/save-invoice", response_model=InvoiceOut)
async def create_invoice(request: Request, payload: Invoice, db: AsyncSession = Depends(get_db)):
    session_id = uuid.UUID(request.state.current_user)
    created_by = await db.run_sync(get_session_user, session_id=session_id)
    invoice = await db.run_sync(save_invoice, payload, created_by=created_by)
    return invoice


@router.post("/edit-invoice", response_model=InvoiceOut)
async def edit_invoice(request: Request, payload: EditInvoice, db: AsyncSession = Depends(get_db)):
    invoice = await db.run_sync(edit_invoice_crud, payload)
    return invoice


@router.post("/get-invoice", response_model=List[InvoiceOut])
async def get_invoicce(filter: dict, db: AsyncSession = Depends(get_db), page: int = 1):
    return await db.run_sync(get_invoice, filter, page)
