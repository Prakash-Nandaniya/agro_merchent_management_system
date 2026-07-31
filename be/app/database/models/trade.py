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

    invoice_no: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, nullable=True
    )

    crop_name: Mapped[str] = mapped_column(String(100), nullable=False)

    vehicle_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # ── Inflow — all nullable ────────────────────────────────────────────────
    party_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mill_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    mill_qty_unit: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    mill_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    mill_rate_unit: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    gst_collected: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    tds_deducted: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    mill_payment: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )

    # ── Outflow — all nullable ───────────────────────────────────────────────
    farmer_payment: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    transport_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    labour_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    other_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    mill_receipt: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    __table_args__ = (
        CheckConstraint("trim(crop_name) <> ''", name="ck_trades_crop_name_not_blank"),
        CheckConstraint(
            "mill_qty IS NULL OR mill_qty_unit IS NOT NULL",
            name="ck_trades_mill_qty_requires_unit",
        ),
        CheckConstraint(
            "mill_rate IS NULL OR mill_rate_unit IS NOT NULL",
            name="ck_trades_mill_rate_requires_unit",
        ),
    )

    def __repr__(self) -> str:
        return f"<Trade(id={self.id}, invoice_no='{self.invoice_no}', mill_payment={self.mill_payment})>"
