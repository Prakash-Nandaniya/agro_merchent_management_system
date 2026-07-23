from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
from pydantic import BaseModel, field_validator,model_validator
from fastapi import Form
import uuid

from app.core.exceptions import (
    BlankFieldError,
    InvalidDateFormatError,
    InvalidNumberError,
    NonPositiveValueError,
    NegativeValueError,
    InvalidFieldTypeError,
)


class CreateTradeSchema(BaseModel):
    invoice_no: str

    trade_creation_date: date

    # ── Inflow ─────────────────────────────────────────────────────────────
    mill_qty: Decimal
    mill_qty_unit: str
    mill_rate: Decimal
    mill_rate_unit: str
    gst_collected: Decimal = Decimal("0.00")
    tds_deducted: Decimal = Decimal("0.00")
    mill_payment: Decimal

    # ── Outflow ────────────────────────────────────────────────────────────
    farmer_payment: Decimal
    transport_cost: Decimal = Decimal("0.00")
    labour_cost: Decimal = Decimal("0.00")
    other_cost: Decimal = Decimal("0.00")

    # ── invoice_no: must not be blank ─────────────────────────────────────
    @field_validator("invoice_no")
    @classmethod
    def invoice_no_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise BlankFieldError("invoice_no")
        return v

    # ── unit fields: must not be blank ──────────────────────────────────────
    @field_validator("mill_qty_unit", "mill_rate_unit")
    @classmethod
    def unit_fields_not_blank(cls, v: str, info) -> str:
        v = v.strip()
        if not v:
            raise BlankFieldError(info.field_name)
        return v

    # ── trade_creation_date: accept "DD-MM-YYYY" strings or date objects ────
    @field_validator("trade_creation_date", mode="before")
    @classmethod
    def parse_trade_date(cls, v):
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            v = v.strip()
            try:
                return datetime.strptime(v, "%d-%m-%Y").date()
            except ValueError:
                raise InvalidDateFormatError("trade_creation_date")
        raise InvalidFieldTypeError("trade_creation_date", "string or date")

    # ── mill_qty / mill_rate / mill_payment / farmer_payment:
    #    required, must be strictly positive ─────────────────────────────────
    @field_validator(
        "mill_qty",
        "mill_rate",
        "mill_payment",
        "farmer_payment",
        mode="before",
    )
    @classmethod
    def parse_required_positive_decimal(cls, v, info):
        d = _coerce_decimal(v, info.field_name)
        if d <= 0:
            raise NonPositiveValueError(info.field_name)
        return d

    # ── cost/payment fields: optional, default 0, must be >= 0 ──────────────
    @field_validator(
        "gst_collected",
        "tds_deducted",
        "transport_cost",
        "labour_cost",
        "other_cost",
        mode="before",
    )
    @classmethod
    def parse_non_negative_decimal(cls, v, info):
        if v is None or v == "":
            return Decimal("0.00")
        d = _coerce_decimal(v, info.field_name)
        if d < 0:
            raise NegativeValueError(info.field_name)
        return d

    @classmethod
    def as_form(
        cls,
        invoice_no: str = Form(...),
        trade_creation_date: str = Form(...),
        mill_qty: str = Form(...),
        mill_qty_unit: str = Form(...),
        mill_rate: str = Form(...),
        mill_rate_unit: str = Form(...),
        gst_collected: str = Form("0.00"),
        tds_deducted: str = Form("0.00"),
        mill_payment: str = Form(...),
        farmer_payment: str = Form(...),
        transport_cost: str = Form("0.00"),
        labour_cost: str = Form("0.00"),
        other_cost: str = Form("0.00"),
    ):
        return cls(
            invoice_no=invoice_no,
            trade_creation_date=trade_creation_date,
            mill_qty=mill_qty,
            mill_qty_unit=mill_qty_unit,
            mill_rate=mill_rate,
            mill_rate_unit=mill_rate_unit,
            gst_collected=gst_collected,
            tds_deducted=tds_deducted,
            mill_payment=mill_payment,
            farmer_payment=farmer_payment,
            transport_cost=transport_cost,
            labour_cost=labour_cost,
            other_cost=other_cost,
        )

    def to_orm_kwargs(self) -> dict:
        data = self.model_dump(exclude={"mill_receipt"})
        data.pop("id", None)
        return {"bill": data}


class EditTradeSchema(CreateTradeSchema):
    id: int

    @classmethod
    def as_form(
        cls,
        id: str = Form(...),
        invoice_no: str = Form(...),
        trade_creation_date: str = Form(...),
        mill_qty: str = Form(...),
        mill_qty_unit: str = Form(...),
        mill_rate: str = Form(...),
        mill_rate_unit: str = Form(...),
        gst_collected: str = Form("0.00"),
        tds_deducted: str = Form("0.00"),
        mill_payment: str = Form(...),
        farmer_payment: str = Form(...),
        transport_cost: str = Form("0.00"),
        labour_cost: str = Form("0.00"),
        other_cost: str = Form("0.00"),
    ):
        return cls(
            id=int(id),
            invoice_no=invoice_no,
            trade_creation_date=trade_creation_date,
            mill_qty=mill_qty,
            mill_qty_unit=mill_qty_unit,
            mill_rate=mill_rate,
            mill_rate_unit=mill_rate_unit,
            gst_collected=gst_collected,
            tds_deducted=tds_deducted,
            mill_payment=mill_payment,
            farmer_payment=farmer_payment,
            transport_cost=transport_cost,
            labour_cost=labour_cost,
            other_cost=other_cost,
        )

from datetime import datetime
from typing import List

class TradeOut(BaseModel):
    id: int
    invoice_no: str
    trade_creation_date: datetime

    mill_qty: Decimal
    mill_qty_unit: str
    mill_rate: Decimal
    mill_rate_unit: str
    gst_collected: Decimal
    tds_deducted: Decimal
    mill_payment: Decimal

    farmer_payment: Decimal
    transport_cost: Decimal
    labour_cost: Decimal
    other_cost: Decimal

    mill_receipt: Optional[str] = None
    created_by: str

    # ── Pulled from the linked MillBill via Trade.invoice ───────────────────
    party_name: Optional[str] = None
    party_city: Optional[str] = None
    seller_name: Optional[str] = None
    crops: List[str] = []

    model_config = {"from_attributes": True}

    # Runs before field validation, on the raw Trade ORM object — flattens
    # trade.invoice.party_name etc. into this schema's own top-level fields,
    # since pydantic's from_attributes can't reach through a relationship
    # to a differently-named nested object on its own.
    @model_validator(mode="before")
    @classmethod
    def flatten_from_orm(cls, obj):
        if hasattr(obj, "invoice"):  # it's a Trade ORM instance, not a raw dict
            bill = obj.invoice
            return {
                "id": obj.id,
                "invoice_no": obj.invoice_no,
                "trade_creation_date": obj.trade_creation_date,
                "mill_qty": obj.mill_qty,
                "mill_qty_unit": obj.mill_qty_unit,
                "mill_rate": obj.mill_rate,
                "mill_rate_unit": obj.mill_rate_unit,
                "gst_collected": obj.gst_collected,
                "tds_deducted": obj.tds_deducted,
                "mill_payment": obj.mill_payment,
                "farmer_payment": obj.farmer_payment,
                "transport_cost": obj.transport_cost,
                "labour_cost": obj.labour_cost,
                "other_cost": obj.other_cost,
                "mill_receipt": obj.mill_receipt,
                "created_by": obj.created_by,
                "party_name": bill.party_name if bill else None,
                "party_city": bill.party_city if bill else None,
                "seller_name": bill.seller_name if bill else None,
                "crops": [c.crop for c in bill.crops] if bill else [],
            }
        return obj
    
def _coerce_decimal(v, field_name: str) -> Decimal:
    if isinstance(v, Decimal):
        return v
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    if isinstance(v, str):
        v = v.strip()
        if not v:
            raise BlankFieldError(field_name)
        try:
            return Decimal(v)
        except InvalidOperation:
            raise InvalidNumberError(field_name)
    raise InvalidFieldTypeError(field_name, "string or number")
