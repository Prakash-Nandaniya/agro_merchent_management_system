from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    String,
    Numeric,
    ForeignKey,
    DateTime,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
from sqlalchemy.sql import func
from app.database.models.mill import MillBill


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

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

    trade_creation_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    invoice_no: Mapped[str] = mapped_column(
        String(50), ForeignKey("mill_bills.invoice_no"), unique=True, nullable=False
    )
   
    invoice: Mapped["MillBill"] = relationship("MillBill", lazy="joined")

    mill_bill_pdf_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── Inflow ─────────────────────────────────────────────────────────────
    mill_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    mill_qty_unit: Mapped[str] = mapped_column(String(10), nullable=False)
    mill_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    mill_rate_unit: Mapped[str] = mapped_column(String(10), nullable=False)
    gst_collected: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    tds_deducted: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    mill_payment: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )

    # ── Outflow ────────────────────────────────────────────────────────────
    farmer_payment: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    transport_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    labour_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    other_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )

    mill_receipt: Mapped[str] = mapped_column(String, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "trim(invoice_no) <> ''", name="ck_trades_invoice_no_not_blank"
        ),
        CheckConstraint(
            "trim(mill_qty_unit) <> ''", name="ck_trades_mill_qty_unit_not_blank"
        ),
        CheckConstraint(
            "trim(mill_rate_unit) <> ''", name="ck_trades_mill_rate_unit_not_blank"
        ),
        CheckConstraint("mill_qty > 0", name="ck_trades_mill_qty_positive"),
        CheckConstraint("mill_rate > 0", name="ck_trades_mill_rate_positive"),
        CheckConstraint(
            "gst_collected >= 0", name="ck_trades_gst_collected_non_negative"
        ),
        CheckConstraint(
            "tds_deducted >= 0", name="ck_trades_tds_deducted_non_negative"
        ),
        CheckConstraint(
            "mill_payment >= 0", name="ck_trades_mill_payment_non_negative"
        ),
        CheckConstraint(
            "farmer_payment >= 0", name="ck_trades_farmer_payment_non_negative"
        ),
        CheckConstraint(
            "transport_cost >= 0", name="ck_trades_transport_cost_non_negative"
        ),
        CheckConstraint("labour_cost >= 0", name="ck_trades_labour_cost_non_negative"),
        CheckConstraint("other_cost >= 0", name="ck_trades_other_cost_non_negative"),
    )

    def __repr__(self) -> str:
        return f"<Trade(id={self.id}, invoice_no='{self.invoice_no}', mill_payment={self.mill_payment})>"
