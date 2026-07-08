from fastapi import APIRouter, Depends,HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.mill_bill import MillBill, MillBillOut
from app.database.crud.millbill import save_mill_bill, get_mill_bill
from app.core.exceptions import translate_integrity_error
from typing import List

router = APIRouter()


@router.post("/save-mill-bill")
def create_bill(payload: MillBill, db: Session = Depends(get_db)):
    bill = save_mill_bill(db, payload)
    return {"id": bill.id, "invoice_no": bill.invoice_no}


@router.post("/get-mill-bill", response_model=List[MillBillOut])
def get_bill(filter: dict, db: Session = Depends(get_db)):
    return get_mill_bill(db, filter)