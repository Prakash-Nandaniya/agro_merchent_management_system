from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.exceptions import InvalidGSTINError, InvalidPANError, InvalidCropRowError, UQCIsMissing


def _blank_to_none(v):
    return None if isinstance(v, str) and v.strip() == "" else v


class FarmerPurchase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    document_type: str = Field("Purchase Bill", min_length=1, max_length=50, alias="documentType")

    merchant_name: str = Field(..., min_length=1, max_length=100, alias="merchantName")
    merchant_address: str = Field(..., min_length=1, alias="merchantAddress")
    merchant_gstin: str = Field(..., max_length=15, alias="merchantGSTIN")

    voucher_date: date = Field(..., alias="voucherDate")
    voucher_no: Optional[str] = Field(None, max_length=50, alias="voucherNo")

    farmer_name: str = Field(..., min_length=1, max_length=150, alias="farmerName")
    farmer_address: str = Field(..., min_length=1, alias="farmerAddress")
    farmer_village: Optional[str] = Field(None, max_length=50, alias="farmerVillage")
    farmer_state: str = Field("Gujarat", min_length=1, max_length=50, alias="farmerState")
    farmer_pan: Optional[str] = Field(None, max_length=10, alias="farmerPAN")

    crop: str = Field(..., min_length=1, max_length=100)
    hsn_code: str = Field(..., min_length=1, max_length=8, alias="hsnCode")
    qty: Decimal = Field(..., max_digits=10, decimal_places=3)
    uqc: str = Field(..., min_length=1, max_length=10)
    rate: Decimal = Field(..., max_digits=10, decimal_places=2)
    taxable_amount: Decimal = Field(..., max_digits=12, decimal_places=2, alias="taxableAmt")
    cgst_rate: Decimal = Field(Decimal("0.00"), max_digits=5, decimal_places=2, alias="cgstRate")
    cgst_amount: Decimal = Field(Decimal("0.00"), max_digits=12, decimal_places=2, alias="cgstAmt")
    sgst_rate: Decimal = Field(Decimal("0.00"), max_digits=5, decimal_places=2, alias="sgstRate")
    sgst_amount: Decimal = Field(Decimal("0.00"), max_digits=12, decimal_places=2, alias="sgstAmt")
    final_amount: Decimal = Field(..., max_digits=12, decimal_places=2, alias="finalAmt")
    final_amount_in_words: str = Field(..., min_length=1, max_length=500)

    payment_method: str = Field("Cash", min_length=1, max_length=20, alias="paymentMethod")
    payment_reference: Optional[str] = Field(None, max_length=100, alias="paymentReference")
    terms: str = Field("Goods purchased directly from farmer.")

    @field_validator("farmer_village", "payment_reference", "farmer_pan", mode="before")
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

    @field_validator("merchant_gstin")
    @classmethod
    def _validate_merchant_gstin(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not __import__('re').match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", cleaned):
            raise InvalidGSTINError(cleaned)
        return cleaned

    @field_validator("farmer_pan")
    @classmethod
    def _validate_farmer_pan(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip().upper()
        if cleaned in {"", "-"}:
            return None
        if not __import__('re').match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", cleaned):
            raise InvalidPANError(cleaned)
        return cleaned

    @field_validator("merchant_name", "farmer_name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("name is required")
        return v

    @field_validator("payment_method")
    @classmethod
    def _validate_payment_method(cls, v: str) -> str:
        valid = {"Cash", "NEFT", "RTGS", "UPI", "Cheque", "Pending"}
        if v not in valid:
            raise ValueError("invalid payment method")
        return v

    @field_validator("document_type")
    @classmethod
    def _validate_document_type(cls, v: str) -> str:
        valid = {"Purchase Bill", "RCM Purchase Bill", "Payment Receipt"}
        if v not in valid:
            raise ValueError("invalid document type")
        return v

    @field_validator("crop")
    @classmethod
    def _validate_crop(cls, v: str) -> str:
        if not v or not v.strip():
            raise InvalidCropRowError(crop=v, field="crop", detail="Crop name is required")
        return v

    @field_validator("hsn_code")
    @classmethod
    def _validate_hsn_code(cls, v: str, info) -> str:
        if not v or not v.strip():
            raise InvalidCropRowError(crop=info.data.get("crop", ""), field="hsn_code", detail="HSN code is required")
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
            raise InvalidCropRowError(crop=info.data.get("crop", ""), field="qty", detail="qty must be > 0")
        return v

    @field_validator("rate")
    @classmethod
    def _validate_rate(cls, v: Decimal, info) -> Decimal:
        if v <= 0:
            raise InvalidCropRowError(crop=info.data.get("crop", ""), field="rate", detail="rate must be > 0")
        return v

    def to_orm_kwargs(self) -> dict:
        return self.model_dump()


class EditFarmerPurchase(FarmerPurchase):
    voucher_no: str = Field(..., min_length=1, max_length=50, alias="voucherNo")


class FarmerPurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    created_by: str
    updated_at: datetime
    document_type: str
    merchant_name: str
    merchant_address: str
    merchant_gstin: str
    voucher_no: str
    voucher_date: date
    farmer_name: str
    farmer_address: str
    farmer_village: Optional[str] = None
    farmer_state: str
    farmer_pan: Optional[str] = None
    crop: str
    hsn_code: str
    qty: Decimal
    uqc: str
    rate: Decimal
    taxable_amount: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    final_amount: Decimal
    final_amount_in_words: str
    payment_method: str
    payment_reference: Optional[str] = None
    terms: str
