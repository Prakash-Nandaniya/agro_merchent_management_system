"""Add separate farmer purchase invoice counters

Revision ID: bc245f8d9f11
Revises: 1311be5e404b
Create Date: 2026-09-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "bc245f8d9f11"
down_revision: Union[str, Sequence[str], None] = "1311be5e404b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "account",
        sa.Column("purchase_bill_last_invoice_no", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "account",
        sa.Column("rcm_purchase_bill_last_invoice_no", sa.String(length=50), nullable=True),
    )

    # Old column was created mixed-case ("last_farmer_invoiceNo"), so Postgres
    # stored it as a quoted, case-sensitive identifier. Raw SQL has to quote
    # it explicitly — unlike op.add_column/op.drop_column above, which go
    # through SQLAlchemy's compiler and get this handled automatically.
    op.execute(
        """
        UPDATE account
        SET purchase_bill_last_invoice_no = "last_farmer_invoiceNo",
            rcm_purchase_bill_last_invoice_no = "last_farmer_invoiceNo"
        WHERE "last_farmer_invoiceNo" IS NOT NULL
        """
    )

    op.drop_constraint("account_last_farmer_invoiceNo_key", "account", type_="unique")
    op.drop_column("account", "last_farmer_invoiceNo")


def downgrade() -> None:
    op.add_column(
        "account",
        sa.Column("last_farmer_invoiceNo", sa.String(length=50), nullable=True),
    )
    op.create_unique_constraint(None, "account", ["last_farmer_invoiceNo"])

    op.execute(
        """
        UPDATE account
        SET "last_farmer_invoiceNo" = COALESCE(purchase_bill_last_invoice_no, rcm_purchase_bill_last_invoice_no)
        WHERE COALESCE(purchase_bill_last_invoice_no, rcm_purchase_bill_last_invoice_no) IS NOT NULL
        """
    )

    op.drop_column("account", "rcm_purchase_bill_last_invoice_no")
    op.drop_column("account", "purchase_bill_last_invoice_no")