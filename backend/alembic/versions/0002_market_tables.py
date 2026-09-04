"""add market master data tables"""
from alembic import op
import sqlalchemy as sa

revision = "0002_market_tables"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=16), nullable=False, unique=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("market", sa.String(length=32), nullable=False),
        sa.Column("industry", sa.String(length=64)),
        sa.Column("sector", sa.String(length=64)),
        sa.Column("pe_ratio", sa.Numeric(18, 4)),
        sa.Column("pb_ratio", sa.Numeric(18, 4)),
        sa.Column("market_cap", sa.Numeric(20, 2)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "stock_prices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_code", sa.String(length=16), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("open_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("high_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("low_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("close_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("volume", sa.Integer(), nullable=False),
    )

    op.create_index("ix_stocks_code", "stocks", ["code"])
    op.create_index("ix_stocks_industry", "stocks", ["industry"])
    op.create_index("ix_stock_prices_code_date", "stock_prices", ["stock_code", "trade_date"])


def downgrade() -> None:
    op.drop_index("ix_stock_prices_code_date", table_name="stock_prices")
    op.drop_index("ix_stocks_industry", table_name="stocks")
    op.drop_index("ix_stocks_code", table_name="stocks")
    op.drop_table("stock_prices")
    op.drop_table("stocks")
