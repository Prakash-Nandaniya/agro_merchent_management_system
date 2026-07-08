from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import String, Text, Date, Numeric, ForeignKey, Enum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from app.database.base import Base


class MillBill(Base):
    __tablename__ = "mill_bills"

    # Primary Key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

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
    final_taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    final_cgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    final_sgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
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
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    final_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Relationship back to the parent
    bill: Mapped["MillBill"] = relationship(back_populates="crops")

    def __repr__(self) -> str:
        return f"<BillCrop(crop='{self.crop}', qty={self.qty}, rate={self.rate})>"
