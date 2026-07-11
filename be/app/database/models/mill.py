from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    String,
    Text,
    Date,
    Numeric,
    ForeignKey,
    DateTime,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
from sqlalchemy.sql import func


class MillBill(Base):
    __tablename__ = "mill_bills"

    # Primary Key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[str] = mapped_column(String(100), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Seller / Business Details
    seller_name: Mapped[str] = mapped_column(String(100), nullable=False)
    seller_address: Mapped[str] = mapped_column(Text, nullable=False)
    seller_pan: Mapped[str] = mapped_column(String(10), nullable=False)
    seller_gstin: Mapped[str] = mapped_column(String(15), nullable=False)

    # Invoice
    invoice_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)

    # Transport Metadata
    docket_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    transport_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    delivery_through: Mapped[str] = mapped_column(String(20), nullable=False)

    # Party / Buyer Details
    party_name: Mapped[str] = mapped_column(String(150), nullable=False)
    party_address: Mapped[str] = mapped_column(Text, nullable=False)
    party_city: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    party_state: Mapped[str] = mapped_column(String(50), nullable=False)
    party_gstin: Mapped[str] = mapped_column(String(15), nullable=False)
    party_pan: Mapped[str] = mapped_column(String(10), nullable=False)

    # sellers bank detail
    seller_bank: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    seller_account: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    seller_ifsc: Mapped[Optional[str]] = mapped_column(String(11), nullable=True)

    # final amount and tax details
    final_taxable_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    final_cgst_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00")
    )
    final_sgst_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00")
    )
    final_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    final_amount_in_words: Mapped[str] = mapped_column(String(500), nullable=False)

    # Terms & Conditions
    terms: Mapped[str] = mapped_column(
        Text, default="As per provided in the Quotation and Order Form."
    )

    # Crop Items Relationship (One-to-Many)
    crops: Mapped[List["BillCrop"]] = relationship(
        back_populates="bill", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        CheckConstraint(
            "trim(seller_name) <> ''", name="ck_mill_bills_seller_name_not_blank"
        ),
        CheckConstraint(
            "trim(seller_address) <> ''", name="ck_mill_bills_seller_address_not_blank"
        ),
        CheckConstraint(
            "trim(seller_pan) <> ''", name="ck_mill_bills_seller_pan_not_blank"
        ),
        CheckConstraint(
            "trim(seller_gstin) <> ''", name="ck_mill_bills_seller_gstin_not_blank"
        ),
        CheckConstraint(
            "trim(invoice_no) <> ''", name="ck_mill_bills_invoice_no_not_blank"
        ),
        CheckConstraint(
            "trim(delivery_through) <> ''",
            name="ck_mill_bills_delivery_through_not_blank",
        ),
        CheckConstraint(
            "trim(party_name) <> ''", name="ck_mill_bills_party_name_not_blank"
        ),
        CheckConstraint(
            "trim(party_address) <> ''", name="ck_mill_bills_party_address_not_blank"
        ),
        CheckConstraint(
            "trim(party_state) <> ''", name="ck_mill_bills_party_state_not_blank"
        ),
        CheckConstraint(
            "trim(party_gstin) <> ''", name="ck_mill_bills_party_gstin_not_blank"
        ),
        CheckConstraint(
            "trim(party_pan) <> ''", name="ck_mill_bills_party_pan_not_blank"
        ),
        CheckConstraint(
            "trim(final_amount_in_words) <> ''",
            name="ck_mill_bills_final_amount_in_words_not_blank",
        ),
    )

    def __repr__(self) -> str:
        return f"<MillBill(id={self.id}, invoice_no='{self.invoice_no}', party_name='{self.party_name}')>"


# ─── Crop Rows) ────────────────────────────────────────
class BillCrop(Base):
    __tablename__ = "bill_crops"

    # Primary Key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Foreign Key linking back to the parent MillBill
    bill_id: Mapped[int] = mapped_column(
        ForeignKey("mill_bills.id", ondelete="CASCADE"), nullable=False
    )

    # Crop Detail
    crop: Mapped[str] = mapped_column(String(100), nullable=False)
    hsn_code: Mapped[str] = mapped_column(String(6), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    uqc: Mapped[str] = mapped_column(String(10), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    taxable_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    sgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    cgst_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00")
    )
    sgst_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00")
    )
    final_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Relationship back to the parent
    bill: Mapped["MillBill"] = relationship(back_populates="crops")

    # ── Same '' guard for BillCrop's required string columns ──
    __table_args__ = (
        CheckConstraint("trim(crop) <> ''", name="ck_bill_crops_crop_not_blank"),
        CheckConstraint(
            "trim(hsn_code) <> ''", name="ck_bill_crops_hsn_code_not_blank"
        ),
        CheckConstraint("trim(uqc) <> ''", name="ck_bill_crops_uqc_not_blank"),
    )

    def __repr__(self) -> str:
        return f"<BillCrop(crop='{self.crop}', qty={self.qty}, rate={self.rate})>"
