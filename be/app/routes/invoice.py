from fastapi import APIRouter, Depends,Request
from sqlalchemy.orm import Session
from app.database.session import get_db
from be.app.schemas.invoice import Invoice, InvoiceOut
from app.database.crud.invoice import save_invoice, get_invoice
from app.database.crud.session import get_session_user
from typing import List
import uuid

router = APIRouter()

@router.post("/save-invoice")
def create_bill(request:Request,payload: Invoice,db: Session = Depends(get_db)):
    session_id = uuid.UUID(request.state.current_user) 
    created_by = get_session_user(db, session_id=session_id)  
    bill = save_invoice(db, payload, created_by=created_by)
    return {"id": bill.id, "invoice_no": bill.invoice_no}

@router.post("/get-invoice", response_model=List[InvoiceOut])
def get_bill(filter: dict, db: Session = Depends(get_db), page:int = 1):
    return get_invoice(db, filter, page)