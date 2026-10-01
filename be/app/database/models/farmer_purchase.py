from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.base import Base


class FarmerPurchase(Base):
    __tablename__ = "FarmerPurchases"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by: Mapped[str] = mapped_column(String(100), nullable=False)

    document_type: Mapped[str] = mapped_column(String(50), default="Purchase Bill", nullable=False)
    voucher_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    voucher_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)

    merchant_name: Mapped[str] = mapped_column(String(100), nullable=False)
    merchant_address: Mapped[str] = mapped_column(Text, nullable=False)
    merchant_gstin: Mapped[str] = mapped_column(String(15), nullable=False)
    merchant_pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    farmer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    farmer_address: Mapped[str] = mapped_column(Text, nullable=False)
    farmer_state: Mapped[str] = mapped_column(String(50), default="Gujarat(24)", nullable=False)
    farmer_pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    crop: Mapped[str] = mapped_column(String(100), nullable=False)
    hsn_code: Mapped[str] = mapped_column(String(8), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    uqc: Mapped[str] = mapped_column(String(10), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    sgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    final_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payable_amount_in_words: Mapped[str] = mapped_column(String(500), nullable=False)

    payment_method: Mapped[str] = mapped_column(String(20), default="Cash", nullable=False)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    terms: Mapped[str] = mapped_column(Text, default="Goods purchased directly from farmer.")

    __table_args__ = (
        CheckConstraint("document_type IN ('Purchase Bill', 'RCM Purchase Bill', 'Payment Receipt')", name="ck_farmer_purchases_document_type_valid"),
        CheckConstraint("payment_method IN ('Cash', 'NEFT', 'RTGS', 'UPI', 'Cheque', 'Pending')", name="ck_farmer_purchases_payment_method_valid"),
        CheckConstraint("trim(merchant_name) <> ''", name="ck_farmer_purchases_merchant_name_not_blank"),
        CheckConstraint("trim(merchant_gstin) <> ''", name="ck_farmer_purchases_merchant_gstin_not_blank"),
        CheckConstraint("trim(voucher_no) <> ''", name="ck_farmer_purchases_voucher_no_not_blank"),
        CheckConstraint("voucher_date IS NOT NULL", name="ck_farmer_purchases_voucher_date_not_null"),
        CheckConstraint("trim(farmer_name) <> ''", name="ck_farmer_purchases_farmer_name_not_blank"),
        CheckConstraint("trim(crop) <> ''", name="ck_farmer_purchases_crop_not_blank"),
        CheckConstraint("qty IS NOT NULL AND qty > 0", name="ck_farmer_purchases_qty_positive"),
        CheckConstraint("rate IS NOT NULL AND rate > 0", name="ck_farmer_purchases_rate_positive"),
        CheckConstraint("payable_amount IS NOT NULL", name="ck_farmer_purchases_payable_amount_not_null"),
        CheckConstraint("trim(payable_amount_in_words) <> ''", name="ck_farmer_purchases_payable_amount_in_words_not_blank"),
    )

    def __repr__(self) -> str:
        return f"<FarmerPurchase(id={self.id}, voucher_no='{self.voucher_no}', farmer_name='{self.farmer_name}', crop='{self.crop}')>"
