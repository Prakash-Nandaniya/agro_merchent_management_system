from fastapi import APIRouter, Depends,Request
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.invoice import Invoice, InvoiceOut, EditInvoice
from app.database.crud.invoice import save_invoice, get_invoice, edit_invoice
from app.database.crud.session import get_session_user
from typing import List
import uuid

router = APIRouter()

@router.post("/save-invoice",response_model=InvoiceOut)
def create_bill(request:Request,payload: Invoice,db: Session = Depends(get_db)):
    session_id = uuid.UUID(request.state.current_user) 
    created_by = get_session_user(db, session_id=session_id)  
    invoice = save_invoice(db, payload, created_by=created_by)
    return invoice

@router.post("/edit-invoice",response_model=InvoiceOut)
def create_bill(request:Request,payload: EditInvoice,db: Session = Depends(get_db)):
    invoice = edit_invoice(db, payload)
    return invoice

@router.post("/get-invoice", response_model=List[InvoiceOut])
def get_bill(filter: dict, db: Session = Depends(get_db), page:int = 1):
    return get_invoice(db, filter, page)