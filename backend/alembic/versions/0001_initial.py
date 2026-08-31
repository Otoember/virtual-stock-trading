"""initial schema"""
from alembic import op
import sqlalchemy as sa


revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(length=64), nullable=False, unique=True),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('status', sa.Enum('ACTIVE', 'DISABLED', name='userstatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_login', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('ix_users_email', 'users', ['email'])

    op.create_table('accounts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('initial_cash', sa.Numeric(18, 2), nullable=False),
        sa.Column('cash', sa.Numeric(18, 2), nullable=False),
        sa.Column('frozen_cash', sa.Numeric(18, 2), nullable=False),
        sa.Column('market_value', sa.Numeric(18, 2), nullable=False),
        sa.Column('total_assets', sa.Numeric(18, 2), nullable=False),
        sa.Column('total_profit', sa.Numeric(18, 2), nullable=False),
        sa.Column('total_return', sa.Numeric(18, 6), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    op.create_table('positions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('symbol', sa.String(length=16), nullable=False),
        sa.Column('stock_name', sa.String(length=64), nullable=False),
        sa.Column('total_quantity', sa.Integer(), nullable=False),
        sa.Column('available_quantity', sa.Integer(), nullable=False),
        sa.Column('today_bought_quantity', sa.Integer(), nullable=False),
        sa.Column('avg_cost', sa.Numeric(18, 4), nullable=False),
        sa.Column('current_price', sa.Numeric(18, 4), nullable=False),
        sa.Column('market_value', sa.Numeric(18, 2), nullable=False),
        sa.Column('unrealized_profit', sa.Numeric(18, 2), nullable=False),
        sa.Column('unrealized_return', sa.Numeric(18, 6), nullable=False),
        sa.Column('realized_profit', sa.Numeric(18, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('user_id', 'symbol', name='uq_positions_user_symbol')
    )
    op.create_index('ix_positions_user_symbol', 'positions', ['user_id', 'symbol'])

    op.create_table('orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('symbol', sa.String(length=16), nullable=False),
        sa.Column('stock_name', sa.String(length=64), nullable=False),
        sa.Column('side', sa.Enum('BUY', 'SELL', name='orderside'), nullable=False),
        sa.Column('order_type', sa.Enum('MARKET', name='ordertype'), nullable=False),
        sa.Column('price', sa.Numeric(18, 4), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('filled_quantity', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED', name='orderstatus'), nullable=False),
        sa.Column('estimated_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('actual_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('fee', sa.Numeric(18, 2), nullable=False),
        sa.Column('idempotency_key', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_orders_user_created', 'orders', ['user_id', 'created_at'])
    op.create_unique_constraint('uq_orders_user_idem', 'orders', ['user_id', 'idempotency_key'])

    op.create_table('trades',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('symbol', sa.String(length=16), nullable=False),
        sa.Column('side', sa.Enum('BUY', 'SELL', name='orderside'), nullable=False),
        sa.Column('price', sa.Numeric(18, 4), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('gross_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('fee', sa.Numeric(18, 2), nullable=False),
        sa.Column('net_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('executed_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_trades_user_executed', 'trades', ['user_id', 'executed_at'])

    op.create_table('daily_asset_snapshots',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('cash', sa.Numeric(18, 2), nullable=False),
        sa.Column('market_value', sa.Numeric(18, 2), nullable=False),
        sa.Column('total_assets', sa.Numeric(18, 2), nullable=False),
        sa.Column('daily_profit', sa.Numeric(18, 2), nullable=False),
        sa.Column('daily_return', sa.Numeric(18, 6), nullable=False),
        sa.Column('cumulative_profit', sa.Numeric(18, 2), nullable=False),
        sa.Column('cumulative_return', sa.Numeric(18, 6), nullable=False),
        sa.UniqueConstraint('user_id', 'date', name='uq_assets_user_date')
    )
    op.create_index('ix_assets_user_date', 'daily_asset_snapshots', ['user_id', 'date'])

    op.create_table('trading_day_states',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('symbol', sa.String(length=16), nullable=False),
        sa.Column('last_trade_date', sa.Date(), nullable=False),
        sa.UniqueConstraint('user_id', 'symbol', name='uq_trading_day_state')
    )


def downgrade() -> None:
    op.drop_table('trading_day_states')
    op.drop_index('ix_assets_user_date', table_name='daily_asset_snapshots')
    op.drop_table('daily_asset_snapshots')
    op.drop_index('ix_trades_user_executed', table_name='trades')
    op.drop_table('trades')
    op.drop_constraint('uq_orders_user_idem', 'orders', type_='unique')
    op.drop_index('ix_orders_user_created', table_name='orders')
    op.drop_table('orders')
    op.drop_index('ix_positions_user_symbol', table_name='positions')
    op.drop_table('positions')
    op.drop_table('accounts')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_table('users')
