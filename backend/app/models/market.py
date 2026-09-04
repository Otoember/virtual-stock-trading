from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, Integer, Numeric, String, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class Stock(Base):
    """股票基础信息表，用于承载市场主数据。"""

    __tablename__ = "stocks"
    __table_args__ = (
        Index("ix_stocks_code", "code"),
        Index("ix_stocks_industry", "industry"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    market: Mapped[str] = mapped_column(String(32), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(64))
    sector: Mapped[str | None] = mapped_column(String(64))
    pe_ratio: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    pb_ratio: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    market_cap: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class StockPrice(Base):
    """股票历史行情数据，用于K线、指标和回测。"""

    __tablename__ = "stock_prices"
    __table_args__ = (
        Index("ix_stock_prices_code_date", "stock_code", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stock_code: Mapped[str] = mapped_column(String(16), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    open_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    high_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    low_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    close_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    volume: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
