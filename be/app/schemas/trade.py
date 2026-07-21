from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
from pydantic import BaseModel, field_validator

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

    mill_deposite_bank_account: Optional[str] = None

    # ── Inflow ─────────────────────────────────────────────────────────────
    mill_qty: Decimal
    mill_qty_unit: str
    mill_rate: Decimal
    mill_rate_unit: str
    gst_collected: Decimal = Decimal("0.00")
    tds_deducted: Decimal = Decimal("0.00")
    mill_payment: Decimal = Decimal("0.00")

    # ── Outflow ────────────────────────────────────────────────────────────
    farmer_payment: Decimal = Decimal("0.00")
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
    def unit_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise BlankFieldError("unit")
        return v

    # ── trade_creation_date: accept "YYYY-MM-DD" strings or date objects ────
    @field_validator("trade_creation_date", mode="before")
    @classmethod
    def parse_trade_date(cls, v):
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            v = v.strip()
            try:
                return datetime.strptime(v, "%Y-%m-%d").date()
            except ValueError:
                raise InvalidDateFormatError("trade_creation_date")
        raise InvalidFieldTypeError("trade_creation_date", "string or date")

    # ── mill_qty / mill_rate: required, must be strictly positive ───────────
    @field_validator("mill_qty", "mill_rate", mode="before")
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
        "mill_payment",
        "farmer_payment",
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