from datetime import date,datetime
from decimal import Decimal
from typing import List, Optional
from app.core.exceptions import InvalidPANError,InvalidGSTINError,InvalidIFSCError,MissingCropRowsError,InvalidCropRowError,DeliveryThroughMissing
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, field_serializer
import re

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


def _blank_to_zero(v):
    """Frontend sends '' for unused numeric fields; Decimal can't parse that."""
    return "0" if v in (None, "") else v


def _blank_to_none(v):
    return None if isinstance(v, str) and v.strip() == "" else v


# ═══════════════════════════ Crop row ═══════════════════════════
class Crops(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    crop: str = Field("", max_length=100)
    hsn_code: str = Field("", max_length=6, alias="hsnCode")
    qty: Decimal = Field(Decimal(0), max_digits=10, decimal_places=2)
    uqc: str = Field("", max_length=10)
    rate: Decimal = Field(Decimal(0), max_digits=10, decimal_places=2)
    taxable_value: Decimal = Field(Decimal(0), max_digits=12, decimal_places=2, alias="taxableAmt")
    cgst_rate: Decimal = Field(Decimal(0), max_digits=5, decimal_places=2, alias="cgstRate")
    cgst_amount: Decimal = Field(Decimal(0), max_digits=12, decimal_places=2, alias="cgstAmt")
    sgst_rate: Decimal = Field(Decimal(0), max_digits=5, decimal_places=2, alias="sgstRate")
    sgst_amount: Decimal = Field(Decimal(0), max_digits=12, decimal_places=2, alias="sgstAmt")
    final_amount: Decimal = Field(Decimal(0), max_digits=12, decimal_places=2, alias="finalAmt")

    # Pydantic can't parse "" as a Decimal, so intercept before type coercion
    @field_validator("qty", "rate", "taxable_value", "cgst_rate", "cgst_amount",
                      "sgst_rate", "sgst_amount", "final_amount", mode="before")
    @classmethod
    def _empty_string_to_zero(cls, v):
        return _blank_to_zero(v)

    @property
    def is_blank(self) -> bool:
        return not self.crop.strip()


# ═══════════════════════════ MillBill ═══════════════════════════
class MillBill(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    seller_name: str = Field(..., min_length=1, max_length=100, alias="sellerName")
    seller_address: str = Field(..., min_length=1, alias="sellerAddress")
    seller_pan: str = Field(..., max_length=10, alias="sellerPAN")
    seller_gstin: str = Field(..., max_length=15, alias="sellerGSTIN")
    seller_bank: Optional[str] = Field(None, max_length=100, alias="sellerBank")
    seller_account: Optional[str] = Field(None, max_length=30, alias="sellerAccount")
    seller_ifsc: Optional[str] = Field(None, max_length=11, alias="sellerIFSC")

    invoice_no: str = Field(..., min_length=1, max_length=50, alias="invoiceNo")
    invoice_date: date = Field(..., alias="invoiceDate")  # "2026-07-07" -> date, automatically

    docket_no: Optional[str] = Field(None, max_length=50, alias="docketNo")
    transport_name: Optional[str] = Field(None, max_length=100, alias="transportName")
    delivery_through: str = Field(..., min_length=1, max_length=20, alias="deliveryThrough")

    party_name: str = Field(..., min_length=1, max_length=150, alias="partyName")
    party_address: str = Field(..., min_length=1, alias="partyAddress")
    party_city: Optional[str] = Field(None, max_length=50, alias="partyCity")
    party_state: str = Field(..., min_length=1, max_length=50, alias="partyState")
    party_gstin: str = Field(..., max_length=15, alias="partyGSTIN")
    party_pan: str = Field(..., max_length=10, alias="partyPAN")

    final_taxable_amount: Decimal = Field(..., max_digits=12, decimal_places=2)
    final_cgst_amount: Decimal = Field(Decimal(0), max_digits=12, decimal_places=2)
    final_sgst_amount: Decimal = Field(Decimal(0), max_digits=12, decimal_places=2)
    final_amount: Decimal = Field(..., max_digits=12, decimal_places=2)
    final_amount_in_words: str = Field(..., min_length=1, max_length=500)

    terms: str = Field("As per provided in the Quotation and Order Form.")

    crops: List[Crops] = Field(default_factory=list)

    # ── blank optional strings -> None ──
    @field_validator("docket_no", "transport_name", "party_city",
                      "seller_bank", "seller_account", "seller_ifsc", mode="before")
    @classmethod
    def _optional_blank_to_none(cls, v):
        return _blank_to_none(v)

    # ── blank totals -> 0 (in case a bill somehow has no crops yet) ──
    @field_validator("final_taxable_amount", "final_cgst_amount", "final_sgst_amount", "final_amount", mode="before")
    @classmethod
    def _totals_blank_to_zero(cls, v):
        return _blank_to_zero(v)

    # ── format checks (things Pydantic types can't express on their own) ──
    @field_validator("seller_pan", "party_pan")
    @classmethod
    def _validate_pan(cls, v: str) -> str:
        v = v.strip().upper()
        if not PAN_RE.match(v):
            raise InvalidPANError("Invalid PAN format, expected e.g. ABCDE1234F")
        return v

    @field_validator("seller_gstin", "party_gstin")
    @classmethod
    def _validate_gstin(cls, v: str) -> str:
        v = v.strip().upper()
        if not GSTIN_RE.match(v):
            raise InvalidGSTINError("Invalid GSTIN format")
        return v

    @field_validator("seller_ifsc")
    @classmethod
    def _validate_ifsc(cls, v):
        if v is None:
            return None
        v = v.strip().upper()
        if not IFSC_RE.match(v):
            raise InvalidIFSCError("Invalid IFSC format, expected e.g. HDFC0001234")
        return v
    
    @field_validator("delivery_through")
    @classmethod
    def _validate_delivery_through(cls, v):
        if not v:
            raise DeliveryThroughMissing("Delivery through is required")
        return v

    # ── business rules: drop blank crop rows, require >=1, qty/rate > 0 ──
    @model_validator(mode="after")
    def _clean_and_check_crops(self):
        real_rows = [c for c in self.crops if not c.is_blank]
        if not real_rows:
            raise MissingCropRowsError("At least one crop row is required")
        for row in real_rows:
            if row.qty <= 0:
                raise InvalidCropRowError(crop=row.crop, field="qty", detail=f"qty must be > 0 for crop '{row.crop}'")
            if row.rate <= 0:
                raise InvalidCropRowError(crop=row.crop, field="rate", detail=f"rate must be > 0 for crop '{row.crop}'")
        object.__setattr__(self, "crops", real_rows)
        return self

    # ── ready-to-use ORM kwargs, no re-conversion needed since types are already right ──
    def to_orm_kwargs(self) -> dict:
        bill_kwargs = self.model_dump(exclude={"crops"})
        crop_kwargs = [row.model_dump(exclude={"is_blank"}) for row in self.crops]
        return {"bill": bill_kwargs, "crops": crop_kwargs}



class BillCropOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    crop: str
    hsn_code: str
    qty: Decimal
    uqc: str
    rate: Decimal
    taxable_value: Decimal
    cgst_rate: Decimal
    sgst_rate: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    final_amount: Decimal
 
    # Every Decimal goes out as a full-precision string — never rounded here,
    # never allowed to collapse into a float. The frontend rounds to 2dp for display only.
    @field_serializer(
        "qty",
        "rate",
        "taxable_value",
        "cgst_rate",
        "sgst_rate",
        "cgst_amount",
        "sgst_amount",
        "final_amount",
    )
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)
 
 
class MillBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    created_at: datetime
    updated_at: datetime
    seller_name: str
    seller_address: str
    seller_pan: str
    seller_gstin: str
    invoice_no: str
    invoice_date: date
    docket_no: Optional[str] = None
    transport_name: Optional[str] = None
    delivery_through: str
    party_name: str
    party_address: str
    party_city: Optional[str] = None
    party_state: str
    party_gstin: str
    party_pan: str
    seller_bank: Optional[str] = None
    seller_account: Optional[str] = None
    seller_ifsc: Optional[str] = None
    final_taxable_amount: Decimal
    final_cgst_amount: Decimal
    final_sgst_amount: Decimal
    final_amount: Decimal
    final_amount_in_words: str
    terms: str
    crops: List[BillCropOut] = []
 
    @field_serializer(
        "final_taxable_amount",
        "final_cgst_amount",
        "final_sgst_amount",
        "final_amount",
    )
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)
