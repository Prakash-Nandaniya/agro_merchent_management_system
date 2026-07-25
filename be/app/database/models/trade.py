from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    String,
    Numeric,
    DateTime,
    CheckConstraint,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base
from sqlalchemy.sql import func


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    
    created_by: Mapped[str] = mapped_column(String(100), nullable=False)

    trade_creation_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Trade details — nullable, except crop_name ──────────────────────────
    invoice_no: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    party_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    party_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    party_gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)

    crop_name: Mapped[str] = mapped_column(String(100), nullable=False)

    invoice_crop_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    invoice_crop_qty_unit: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    invoice_crop_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    invoice_crop_rate_unit: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    vehicle_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # ── Inflow — all nullable ────────────────────────────────────────────────
    mill_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    mill_qty_unit: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    mill_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    mill_rate_unit: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    gst_collected: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    tds_deducted: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    mill_payment: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    # ── Outflow — all nullable ───────────────────────────────────────────────
    farmer_payment: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    transport_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    labour_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    other_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mill_receipt: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    __table_args__ = (
        CheckConstraint("trim(crop_name) <> ''", name="ck_trades_crop_name_not_blank"),

        CheckConstraint(
            "invoice_no IS NULL OR trim(invoice_no) <> ''",
            name="ck_trades_invoice_no_not_blank",
        ),
        CheckConstraint(
            "mill_qty_unit IS NULL OR trim(mill_qty_unit) <> ''",
            name="ck_trades_mill_qty_unit_not_blank",
        ),
        CheckConstraint(
            "mill_rate_unit IS NULL OR trim(mill_rate_unit) <> ''",
            name="ck_trades_mill_rate_unit_not_blank",
        ),

        CheckConstraint("mill_qty IS NULL OR mill_qty > 0", name="ck_trades_mill_qty_positive"),
        CheckConstraint("mill_rate IS NULL OR mill_rate > 0", name="ck_trades_mill_rate_positive"),
        CheckConstraint(
            "gst_collected IS NULL OR gst_collected >= 0",
            name="ck_trades_gst_collected_non_negative",
        ),
        CheckConstraint(
            "tds_deducted IS NULL OR tds_deducted >= 0",
            name="ck_trades_tds_deducted_non_negative",
        ),
        CheckConstraint(
            "mill_payment IS NULL OR mill_payment >= 0",
            name="ck_trades_mill_payment_non_negative",
        ),
        CheckConstraint(
            "farmer_payment IS NULL OR farmer_payment >= 0",
            name="ck_trades_farmer_payment_non_negative",
        ),
        CheckConstraint(
            "transport_cost IS NULL OR transport_cost >= 0",
            name="ck_trades_transport_cost_non_negative",
        ),
        CheckConstraint(
            "labour_cost IS NULL OR labour_cost >= 0",
            name="ck_trades_labour_cost_non_negative",
        ),
        CheckConstraint(
            "other_cost IS NULL OR other_cost >= 0",
            name="ck_trades_other_cost_non_negative",
        ),
    )

    def __repr__(self) -> str:
        return f"<Trade(id={self.id}, invoice_no='{self.invoice_no}', mill_payment={self.mill_payment})>"