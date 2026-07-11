from fastapi import APIRouter, Depends,Request
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.mill_bill import MillBill, MillBillOut
from app.database.crud.millbill import save_mill_bill, get_mill_bill
from app.database.crud.session import get_session_user
from typing import List
import uuid

router = APIRouter()

@router.post("/save-mill-bill")
def create_bill(request:Request,payload: MillBill,db: Session = Depends(get_db)):
    session_id = uuid.UUID(request.state.current_user) 
    created_by = get_session_user(db, session_id=session_id)  
    bill = save_mill_bill(db, payload, created_by=created_by)
    return {"id": bill.id, "invoice_no": bill.invoice_no}

@router.post("/get-mill-bill", response_model=List[MillBillOut])
def get_bill(filter: dict, db: Session = Depends(get_db)):
    return get_mill_bill(db, filter)