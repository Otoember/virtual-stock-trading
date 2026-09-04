from datetime import datetime, date
from decimal import Decimal
import enum
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class UserStatus(str, enum.Enum):
    ACTIVE = 'ACTIVE'
    DISABLED = 'DISABLED'


class OrderSide(str, enum.Enum):
    BUY = 'BUY'
    SELL = 'SELL'


class OrderType(str, enum.Enum):
    MARKET = 'MARKET'
    LIMIT = 'LIMIT'


class OrderStatus(str, enum.Enum):
    PENDING = 'PENDING'
    FILLED = 'FILLED'
    PARTIALLY_FILLED = 'PARTIALLY_FILLED'
    CANCELLED = 'CANCELLED'
    REJECTED = 'REJECTED'


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)

    account = relationship('Account', back_populates='user', uselist=False)


class Account(Base):
    __tablename__ = 'accounts'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    initial_cash: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    cash: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    frozen_cash: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal('0'), nullable=False)
    market_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal('0'), nullable=False)
    total_assets: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    total_profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal('0'), nullable=False)
    total_return: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal('0'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship('User', back_populates='account')


class Position(Base):
    __tablename__ = 'positions'
    __table_args__ = (
        UniqueConstraint('user_id', 'symbol', name='uq_positions_user_symbol'),
        Index('ix_positions_user_symbol', 'user_id', 'symbol'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    stock_name: Mapped[str] = mapped_column(String(64), nullable=False)
    total_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    today_bought_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal('0'))
    current_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal('0'))
    market_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal('0'))
    unrealized_profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal('0'))
    unrealized_return: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=Decimal('0'))
    realized_profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal('0'))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Order(Base):
    __tablename__ = 'orders'
    __table_args__ = (
        Index('ix_orders_user_created', 'user_id', 'created_at'),
        UniqueConstraint('user_id', 'idempotency_key', name='uq_orders_user_idem'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    stock_name: Mapped[str] = mapped_column(String(64), nullable=False)
    side: Mapped[OrderSide] = mapped_column(Enum(OrderSide), nullable=False)
    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType), nullable=False, default=OrderType.MARKET)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    limit_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    filled_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    remaining_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), nullable=False, default=OrderStatus.PENDING)
    estimated_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    actual_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal('0'))
    reserved_cash: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal('0'))
    rejection_reason: Mapped[str | None] = mapped_column(String(255))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Trade(Base):
    __tablename__ = 'trades'
    __table_args__ = (Index('ix_trades_user_executed', 'user_id', 'executed_at'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    side: Mapped[OrderSide] = mapped_column(Enum(OrderSide), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class DailyAssetSnapshot(Base):
    __tablename__ = 'daily_asset_snapshots'
    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_assets_user_date'),
        Index('ix_assets_user_date', 'user_id', 'date'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    cash: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    market_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    total_assets: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    daily_profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    daily_return: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    cumulative_profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    cumulative_return: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)


class TradingDayState(Base):
    __tablename__ = 'trading_day_states'
    __table_args__ = (UniqueConstraint('user_id', 'symbol', name='uq_trading_day_state'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    last_trade_date: Mapped[date] = mapped_column(Date, nullable=False)
