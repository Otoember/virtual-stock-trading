from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field


class PlaceOrderRequest(BaseModel):
    symbol: str = Field(min_length=6, max_length=6)
    side: str
    quantity: int = Field(gt=0)


class OrderResponse(BaseModel):
    id: int
    symbol: str
    stock_name: str
    side: str
    price: Decimal
    quantity: int
    status: str
    actual_amount: Decimal
    fee: Decimal
    created_at: datetime


class TradeResponse(BaseModel):
    id: int
    order_id: int
    symbol: str
    side: str
    price: Decimal
    quantity: int
    gross_amount: Decimal
    fee: Decimal
    net_amount: Decimal
    executed_at: datetime


class PositionResponse(BaseModel):
    symbol: str
    stock_name: str
    total_quantity: int
    available_quantity: int
    today_bought_quantity: int
    avg_cost: Decimal
    current_price: Decimal
    market_value: Decimal
    unrealized_profit: Decimal
    unrealized_return: Decimal
    realized_profit: Decimal


class AccountResponse(BaseModel):
    initial_cash: Decimal
    cash: Decimal
    frozen_cash: Decimal
    market_value: Decimal
    total_assets: Decimal
    total_profit: Decimal
    total_return: Decimal


class AssetSnapshotResponse(BaseModel):
    date: date
    cash: Decimal
    market_value: Decimal
    total_assets: Decimal
    daily_profit: Decimal
    daily_return: Decimal
    cumulative_profit: Decimal
    cumulative_return: Decimal


class LeaderboardRow(BaseModel):
    rank: int
    username: str
    total_assets: Decimal
    cumulative_return: Decimal
    daily_return: Decimal
