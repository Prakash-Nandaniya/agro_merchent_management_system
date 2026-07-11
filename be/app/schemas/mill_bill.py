from datetime import date,datetime
from decimal import Decimal,ROUND_HALF_UP
from typing import List, Optional
from app.core.exceptions import InvalidPANError,InvalidGSTINError,InvalidIFSCError,MissingCropRowsError,InvalidCropRowError,DeliveryThroughMissing,UQCIsMissing
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, field_serializer
import re

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")



def _blank_to_none(v):
    return None if isinstance(v, str) and v.strip() == "" else v

# ═══════════════════════════ Crop row ═══════════════════════════
class Crops(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    crop: str = Field("", max_length=100)
    hsn_code: str = Field("", max_length=6, alias="hsnCode")
    qty: Decimal = Field(Decimal("0.00"), max_digits=10, decimal_places=2)
    uqc: str = Field("", max_length=10)
    rate: Decimal = Field(Decimal("0.00"), max_digits=10, decimal_places=2)
    taxable_value: Decimal = Field(Decimal("0.00"), max_digits=12, decimal_places=2, alias="taxableAmt")
    cgst_rate: Decimal = Field(Decimal("0.00"), max_digits=5, decimal_places=2, alias="cgstRate")
    cgst_amount: Decimal = Field(Decimal("0.00"), max_digits=12, decimal_places=2, alias="cgstAmt")
    sgst_rate: Decimal = Field(Decimal("0.00"), max_digits=5, decimal_places=2, alias="sgstRate")
    sgst_amount: Decimal = Field(Decimal("0.00"), max_digits=12, decimal_places=2, alias="sgstAmt")
    final_amount: Decimal = Field(Decimal("0.00"), max_digits=12, decimal_places=2, alias="finalAmt")

    # ── Forces empty strings to "0" and safely rounds ALL numbers to 2 decimal places ──
    @field_validator("qty", "rate", "taxable_value", "cgst_rate", "cgst_amount",
                      "sgst_rate", "sgst_amount", "final_amount", mode="before")
    @classmethod
    def _parse_and_round_decimal(cls, v):
        v = "0" if v in (None, "") else str(v)
        # Quantize forces the number into exactly X.XX format
        return Decimal(v).quantize(Decimal("0.00"), rounding=ROUND_HALF_UP)

    # MOVED HERE from MillBill — "uqc" is a field on Crops, not on MillBill.
    # A field_validator targeting a field name that doesn't exist on the
    # class it's attached to raises PydanticUserError at import time, which
    # was breaking this entire module. Also fixed `v.length` (not a real
    # attribute on str) -> `len(v)`.
    @field_validator("uqc")
    @classmethod
    def _validate_uqc(cls, v: str) -> str:
        if len(v) < 1:
            raise UQCIsMissing("UQC is required")
        return v

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
    invoice_date: date = Field(..., alias="invoiceDate")

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
    final_cgst_amount: Decimal = Field(Decimal("0.00"), max_digits=12, decimal_places=2)
    final_sgst_amount: Decimal = Field(Decimal("0.00"), max_digits=12, decimal_places=2)
    final_amount: Decimal = Field(..., max_digits=12, decimal_places=2)
    final_amount_in_words: str = Field(..., min_length=1, max_length=500)

    terms: str = Field("As per provided in the Quotation and Order Form.")

    crops: List[Crops] = Field(default_factory=list)

    # NOTE: created_by is intentionally NOT a field here. It must come from
    # the verified JWT server-side (see app/core/auth.py's
    # get_current_account_id), never from client-supplied request body —
    # otherwise anyone could set created_by to anything they want.

    @field_validator("docket_no", "transport_name", "party_city",
                      "seller_bank", "seller_account", "seller_ifsc", mode="before")
    @classmethod
    def _optional_blank_to_none(cls, v):
        return _blank_to_none(v)

    # ── Forces empty totals to "0" and safely rounds ALL numbers to 2 decimal places ──
    @field_validator("final_taxable_amount", "final_cgst_amount", "final_sgst_amount", "final_amount", mode="before")
    @classmethod
    def _parse_and_round_totals(cls, v):
        v = "0" if v in (None, "") else str(v)
        return Decimal(v).quantize(Decimal("0.00"), rounding=ROUND_HALF_UP)

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
    created_by: str
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