from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel


class StockQuote(BaseModel):
    symbol: str
    name: str
    price: Decimal
    change: Decimal
    change_percent: Decimal
    volume: int
    updated_at: datetime
    source: str = 'mock'


class StockSearchItem(BaseModel):
    symbol: str
    name: str


class StockHistoryItem(BaseModel):
    date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int


class MarketStatus(BaseModel):
    is_open: bool
    timezone: str
    updated_at: datetime
