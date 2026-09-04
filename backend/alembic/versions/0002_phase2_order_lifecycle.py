"""phase2 order lifecycle fields"""
from alembic import op
import sqlalchemy as sa


revision = '0002_phase2_order_lifecycle'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE ordertype ADD VALUE IF NOT EXISTS 'LIMIT'")

    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('limit_price', sa.Numeric(18, 4), nullable=True))
        batch_op.add_column(sa.Column('remaining_quantity', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('reserved_cash', sa.Numeric(18, 2), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('rejection_reason', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('cancelled_at', sa.DateTime(), nullable=True))

    op.execute("UPDATE orders SET remaining_quantity = quantity - filled_quantity")
    op.execute("UPDATE orders SET reserved_cash = 0")

    with op.batch_alter_table('orders') as batch_op:
        batch_op.alter_column('remaining_quantity', server_default=None)
        batch_op.alter_column('reserved_cash', server_default=None)


def downgrade() -> None:
    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_column('cancelled_at')
        batch_op.drop_column('rejection_reason')
        batch_op.drop_column('reserved_cash')
        batch_op.drop_column('remaining_quantity')
        batch_op.drop_column('limit_price')
