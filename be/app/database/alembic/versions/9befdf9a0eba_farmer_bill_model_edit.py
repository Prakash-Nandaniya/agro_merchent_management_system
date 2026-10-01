"""farmer bill model edit

Revision ID: 9befdf9a0eba
Revises: b9192536ede4
Create Date: 2026-10-01 13:55:24.000050

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9befdf9a0eba'
down_revision: Union[str, Sequence[str], None] = 'b9192536ede4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new column
    op.add_column('FarmerPurchases', sa.Column('merchant_pan', sa.String(length=10), nullable=True))
    
    # Rename the columns instead of drop/add
    op.alter_column('FarmerPurchases', 'taxable_amount', new_column_name='payable_amount')
    op.alter_column('FarmerPurchases', 'final_amount_in_words', new_column_name='payable_amount_in_words')
    
    # Drop the column you actually want to remove
    op.drop_column('FarmerPurchases', 'farmer_village')


def downgrade() -> None:
    """Downgrade schema."""
    # Add back the removed column
    op.add_column('FarmerPurchases', sa.Column('farmer_village', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    
    # Revert the column names
    op.alter_column('FarmerPurchases', 'payable_amount', new_column_name='taxable_amount')
    op.alter_column('FarmerPurchases', 'payable_amount_in_words', new_column_name='final_amount_in_words')
    
    # Drop the added column
    op.drop_column('FarmerPurchases', 'merchant_pan')