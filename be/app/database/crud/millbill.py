from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.exceptions import translate_integrity_error
from app.database.models.mill import MillBill, BillCrop


def save_mill_bill(db: Session, payload: MillBill) -> MillBill:
    data = payload.to_orm_kwargs()

    mill_bill = MillBill(**data["bill"])
    mill_bill.crops = [BillCrop(**row) for row in data["crops"]]

    db.add(mill_bill)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise translate_integrity_error(e)

    db.refresh(mill_bill)
    return mill_bill