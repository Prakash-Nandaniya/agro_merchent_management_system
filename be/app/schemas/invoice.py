from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from app.core.exceptions import (
    InvalidPANError,
    InvalidGSTINError,
    InvalidIFSCError,
    InvalidCropRowError,
    DeliveryThroughMissing,
    UQCIsMissing,
    InvalidEwayBillError,  
)
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    field_serializer,
)
import re
from typing import Optional
from pydantic import BaseModel
from pydantic import BaseModel, ConfigDict

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
EWAY_BILL_RE = re.compile(r"^[0-9 ]+$")

def _blank_to_none(v):
    return None if isinstance(v, str) and v.strip() == "" else v


# ═══════════════════════════ Invoice (merged crop + bill row) ═══════════════════════════
class Invoice(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    seller_name: str = Field(..., min_length=1, max_length=100, alias="sellerName")
    seller_address: str = Field(..., min_length=1, alias="sellerAddress")
    seller_pan: str = Field(..., max_length=10, alias="sellerPAN")
    seller_gstin: str = Field(..., max_length=15, alias="sellerGSTIN")
    seller_bank: Optional[str] = Field(None, max_length=100, alias="sellerBank")
    seller_account: Optional[str] = Field(None, max_length=30, alias="sellerAccount")
    seller_ifsc: Optional[str] = Field(None, max_length=11, alias="sellerIFSC")

    invoice_date: date = Field(..., alias="invoiceDate")
    invoice_no:Optional[str] = Field(None, max_length=50, alias="invoiceNo")
    eway_bill_no: Optional[str] = Field(None, alias="ewayBillNo")    
    docket_no: Optional[str] = Field(None, max_length=50, alias="docketNo")
    transport_name: Optional[str] = Field(None, max_length=100, alias="transportName")
    delivery_through: str = Field(
        ..., min_length=1, max_length=20, alias="deliveryThrough"
    )

    party_name: str = Field(..., min_length=1, max_length=150, alias="partyName")
    party_address: str = Field(..., min_length=1, alias="partyAddress")
    party_city: Optional[str] = Field(None, max_length=50, alias="partyCity")
    party_state: str = Field(..., min_length=1, max_length=50, alias="partyState")
    party_gstin: str = Field(..., max_length=15, alias="partyGSTIN")
    party_pan: str = Field(..., max_length=10, alias="partyPAN")

    crop: str = Field(..., min_length=1, max_length=100)
    hsn_code: str = Field(..., min_length=1, max_length=6, alias="hsnCode")
    qty: Decimal = Field(..., max_digits=10, decimal_places=2)
    uqc: str = Field(..., min_length=1, max_length=10)
    rate: Decimal = Field(..., max_digits=10, decimal_places=2)
    taxable_amount: Decimal = Field(
        ..., max_digits=12, decimal_places=2, alias="taxableAmt"
    )
    cgst_rate: Decimal = Field(
        Decimal("0.00"), max_digits=5, decimal_places=2, alias="cgstRate"
    )
    cgst_amount: Decimal = Field(
        Decimal("0.00"), max_digits=12, decimal_places=2, alias="cgstAmt"
    )
    sgst_rate: Decimal = Field(
        Decimal("0.00"), max_digits=5, decimal_places=2, alias="sgstRate"
    )
    sgst_amount: Decimal = Field(
        Decimal("0.00"), max_digits=12, decimal_places=2, alias="sgstAmt"
    )
    final_amount: Decimal = Field(
        ..., max_digits=12, decimal_places=2, alias="finalAmt"
    )

    final_amount_in_words: str = Field(..., min_length=1, max_length=500)

    terms: str = Field("As per provided in the Quotation and Order Form.")

    @field_validator(
        "eway_bill_no",
        "docket_no",
        "transport_name",
        "party_city",
        "seller_bank",
        "seller_account",
        "seller_ifsc",
        mode="before",
    )
    @classmethod
    def _optional_blank_to_none(cls, v):
        return _blank_to_none(v)

    @field_validator(
        "qty",
        "rate",
        "taxable_amount",
        "cgst_rate",
        "cgst_amount",
        "sgst_rate",
        "sgst_amount",
        "final_amount",
        mode="before",
    )
    @classmethod
    def _parse_and_round_decimal(cls, v):
        v = "0" if v in (None, "") else str(v)
        return Decimal(v).quantize(Decimal("0.00"), rounding=ROUND_HALF_UP)

    @field_validator("seller_pan", "party_pan")
    @classmethod
    def _validate_pan(cls, v: str) -> str:
        v = v.strip().upper()
        if not PAN_RE.match(v):
            raise InvalidPANError(v)
        return v

    @field_validator("seller_gstin", "party_gstin")
    @classmethod
    def _validate_gstin(cls, v: str) -> str:
        v = v.strip().upper()
        if not GSTIN_RE.match(v):
            raise InvalidGSTINError(v)
        return v

    @field_validator("seller_ifsc")
    @classmethod
    def _validate_ifsc(cls, v):
        if v is None:
            return None
        v = v.strip().upper()
        if not IFSC_RE.match(v):
            raise InvalidIFSCError(v)
        return v

    @field_validator("eway_bill_no")
    @classmethod
    def _validate_eway_bill_no(cls, v):
        if v is None:
            return None
        v = v.strip()
        if not EWAY_BILL_RE.match(v):
            raise InvalidEwayBillError(v)
        return v

    @field_validator("delivery_through")
    @classmethod
    def _validate_delivery_through(cls, v):
        if not v or not v.strip():
            raise DeliveryThroughMissing("Delivery through is required")
        return v

    @field_validator("crop")
    @classmethod
    def _validate_crop(cls, v: str) -> str:
        if not v or not v.strip():
            raise InvalidCropRowError(
                crop=v, field="crop", detail="Crop name is required"
            )
        return v

    @field_validator("hsn_code")
    @classmethod
    def _validate_hsn_code(cls, v: str, info) -> str:
        if not v or not v.strip():
            raise InvalidCropRowError(
                crop=info.data.get("crop", ""),
                field="hsn_code",
                detail="HSN code is required",
            )
        return v

    @field_validator("uqc")
    @classmethod
    def _validate_uqc(cls, v: str) -> str:
        if not v or not v.strip():
            raise UQCIsMissing("UQC is required")
        return v

    @field_validator("qty")
    @classmethod
    def _validate_qty(cls, v: Decimal, info) -> Decimal:
        if v <= 0:
            raise InvalidCropRowError(
                crop=info.data.get("crop", ""),
                field="qty",
                detail=f"qty must be > 0 for crop '{info.data.get('crop', '')}'",
            )
        return v

    @field_validator("rate")
    @classmethod
    def _validate_rate(cls, v: Decimal, info) -> Decimal:
        if v <= 0:
            raise InvalidCropRowError(
                crop=info.data.get("crop", ""),
                field="rate",
                detail=f"rate must be > 0 for crop '{info.data.get('crop', '')}'",
            )
        return v

    def to_orm_kwargs(self) -> dict:
        return self.model_dump()


class EditInvoice(Invoice):
    invoice_no: str = Field(..., min_length=1, max_length=50, alias="invoiceNo")


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    created_by: str
    updated_at: datetime
    seller_name: str
    seller_address: str
    seller_pan: str
    seller_gstin: str
    invoice_no: str
    invoice_date: date
    eway_bill_no: Optional[str] = None
    docket_no: Optional[str] = None
    transport_name: Optional[str] = None
    delivery_through: str
    party_name: str
    party_address: str
    party_city: Optional[str] = None
    party_state: str
    party_gstin: str
    party_pan: str
    crop: str
    hsn_code: str
    qty: Decimal
    uqc: str
    rate: Decimal
    taxable_amount: Decimal
    cgst_rate: Decimal
    sgst_rate: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    final_amount: Decimal
    seller_bank: Optional[str] = None
    seller_account: Optional[str] = None
    seller_ifsc: Optional[str] = None
    final_amount_in_words: str
    terms: str

    @field_serializer(
        "qty",
        "rate",
        "taxable_amount",
        "cgst_rate",
        "sgst_rate",
        "cgst_amount",
        "sgst_amount",
        "final_amount",
    )
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)


class InvoicePdfRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    seller_name: str
    seller_address: str
    seller_pan: str
    seller_gstin: str
    invoice_no: str
    invoice_date: str
    eway_bill_no: Optional[str] = None
    docket_no: Optional[str] = None
    transport_name: Optional[str] = None
    delivery_through: str
    party_name: str
    party_address: str
    party_city: Optional[str] = None
    party_state: str
    party_gstin: str
    party_pan: str
    crop: str
    hsn_code: str
    qty: str
    uqc: str
    rate: str
    taxable_amount: str
    cgst_rate: str
    sgst_rate: str
    cgst_amount: str
    sgst_amount: str
    final_amount: str
    seller_bank: Optional[str] = None
    seller_account: Optional[str] = None
    seller_ifsc: Optional[str] = None
    final_amount_in_words: str
    terms: str
