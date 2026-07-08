from fastapi import APIRouter, Depends,HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.mill_bill import MillBill
from app.database.crud.millbill import save_mill_bill
from app.core.exceptions import translate_integrity_error

router = APIRouter()

@router.post("/save-mill-bill")
def create_bill(payload: MillBill, db: Session = Depends(get_db)):
    try:
        bill = save_mill_bill(db, payload)
    except ValueError as e:
        raise translate_integrity_error(e)
    return {"id": bill.id, "invoice_no": bill.invoice_no}