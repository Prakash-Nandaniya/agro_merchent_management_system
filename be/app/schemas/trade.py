from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
from pydantic import BaseModel, field_validator, model_validator
from fastapi import Form

from app.core.exceptions import (
    BlankFieldError,
    InvalidDateFormatError,
    InvalidNumberError,
    InvalidFieldTypeError,
)

class CreateTradeSchema(BaseModel):
    trade_creation_date: date

    crop_name: str

    invoice_no: Optional[str] = None

    party_name: Optional[str] = None

    vehicle_no: Optional[str] = None

    # ── Inflow ───────────────────────────────────────────────────────────────
    mill_qty: Optional[Decimal] = None
    mill_qty_unit: Optional[str] = None
    mill_rate: Optional[Decimal] = None
    mill_rate_unit: Optional[str] = None
    gst_collected: Optional[Decimal] = None
    tds_deducted: Optional[Decimal] = None
    mill_payment: Optional[Decimal] = None

    # ── Outflow ──────────────────────────────────────────────────────────────
    farmer_payment: Optional[Decimal] = None
    transport_cost: Optional[Decimal] = None
    labour_cost: Optional[Decimal] = None
    other_cost: Optional[Decimal] = None

    note: Optional[str] = None
    mill_receipt: Optional[str] = None

    @field_validator("crop_name")
    @classmethod
    def crop_name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise BlankFieldError("crop_name")
        return v

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

    @field_validator("mill_qty", "mill_rate", mode="before")
    @classmethod
    def parse_optional_decimal(cls, v, info):
        if v is None or v == "":
            return None
        return _coerce_decimal(v, info.field_name)

    @model_validator(mode="after")
    def qty_rate_require_their_unit(self) -> "CreateTradeSchema":
        pairs = [
            ("mill_qty", "mill_qty_unit"),
            ("mill_rate", "mill_rate_unit"),
        ]
        for value_field, unit_field in pairs:
            value = getattr(self, value_field)
            unit = getattr(self, unit_field)
            if value is not None and (unit is None or unit.strip() == ""):
                raise BlankFieldError(unit_field)
        return self

    @field_validator(
        "gst_collected",
        "tds_deducted",
        "mill_payment",
        "farmer_payment",
        "transport_cost",
        "labour_cost",
        "other_cost",
        mode="before",
    )
    @classmethod
    def parse_optional_decimal_money(cls, v, info):
        if v is None or v == "":
            return None
        return _coerce_decimal(v, info.field_name)

    @classmethod
    def as_form(
        cls,
        trade_creation_date: str = Form(...),
        crop_name: str = Form(...),
        invoice_no: Optional[str] = Form(None),
        party_name: Optional[str] = Form(None),
        vehicle_no: Optional[str] = Form(None),
        mill_qty: Optional[str] = Form(None),
        mill_qty_unit: Optional[str] = Form(None),
        mill_rate: Optional[str] = Form(None),
        mill_rate_unit: Optional[str] = Form(None),
        gst_collected: Optional[str] = Form(None),
        tds_deducted: Optional[str] = Form(None),
        mill_payment: Optional[str] = Form(None),
        farmer_payment: Optional[str] = Form(None),
        transport_cost: Optional[str] = Form(None),
        labour_cost: Optional[str] = Form(None),
        other_cost: Optional[str] = Form(None),
        note: Optional[str] = Form(None),
    ):
        return cls(
            trade_creation_date=trade_creation_date,
            crop_name=crop_name,
            invoice_no=invoice_no,
            party_name=party_name,
            vehicle_no=vehicle_no,
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
            note=note,
        )

    def to_orm_kwargs(self) -> dict:
        data = self.model_dump(exclude={"mill_receipt"})
        data.pop("id", None)
        return {"bill": data}

class EditTradeSchema(CreateTradeSchema):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # ── Request metadata — NOT trade data, always excluded in to_orm_kwargs ──
    form_edited: bool = False
    mill_receipt_edited: bool = False

    @classmethod
    def as_form(
        cls,
        id: str = Form(...),
        created_by: Optional[str] = Form(None),
        trade_creation_date: str = Form(...),
        crop_name: str = Form(...),
        invoice_no: Optional[str] = Form(None),
        party_name: Optional[str] = Form(None),
        vehicle_no: Optional[str] = Form(None),
        mill_qty: Optional[str] = Form(None),
        mill_qty_unit: Optional[str] = Form(None),
        mill_rate: Optional[str] = Form(None),
        mill_rate_unit: Optional[str] = Form(None),
        gst_collected: Optional[str] = Form(None),
        tds_deducted: Optional[str] = Form(None),
        mill_payment: Optional[str] = Form(None),
        farmer_payment: Optional[str] = Form(None),
        transport_cost: Optional[str] = Form(None),
        labour_cost: Optional[str] = Form(None),
        other_cost: Optional[str] = Form(None),
        note: Optional[str] = Form(None),
        created_at: Optional[str] = Form(None),
        updated_at: Optional[str] = Form(None),
        form_edited: bool = Form(False),
        mill_receipt_edited: bool = Form(False),
    ):
        return cls(
            id=int(id),
            created_by=created_by,
            trade_creation_date=trade_creation_date,
            crop_name=crop_name,
            invoice_no=invoice_no,
            party_name=party_name,
            vehicle_no=vehicle_no,
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
            note=note,
            created_at=created_at,
            updated_at=updated_at,
            form_edited=form_edited,
            mill_receipt_edited=mill_receipt_edited,
        )

    def to_orm_kwargs(self) -> dict:
        data = self.model_dump(
            exclude={
                "mill_receipt",
                "created_at",
                "updated_at",
                "form_edited",
                "mill_receipt_edited",
            }
        )
        data.pop("id", None)
        return {"bill": data}

class TradeOut(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    trade_creation_date: datetime
    created_by: str

    invoice_no: Optional[str] = None
    party_name: Optional[str] = None
    crop_name: str

    vehicle_no: Optional[str] = None

    mill_qty: Optional[Decimal] = None
    mill_qty_unit: Optional[str] = None
    mill_rate: Optional[Decimal] = None
    mill_rate_unit: Optional[str] = None
    gst_collected: Optional[Decimal] = None
    tds_deducted: Optional[Decimal] = None
    mill_payment: Optional[Decimal] = None

    farmer_payment: Optional[Decimal] = None
    transport_cost: Optional[Decimal] = None
    labour_cost: Optional[Decimal] = None
    other_cost: Optional[Decimal] = None

    note: Optional[str] = None
    mill_receipt: Optional[str] = None

    model_config = {"from_attributes": True}


def _coerce_decimal(v, field_name: str) -> Decimal:
    if isinstance(v, Decimal):
        return v
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
        try:
            return Decimal(v)
        except InvalidOperation:
            raise InvalidNumberError(field_name)
    raise InvalidFieldTypeError(field_name, "string or number")
