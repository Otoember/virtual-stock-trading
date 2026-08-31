from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Account, Position


def refresh_account_assets(db: Session, user_id: int) -> Account:
    account = db.scalar(select(Account).where(Account.user_id == user_id))
    assert account is not None
    positions = db.scalars(select(Position).where(Position.user_id == user_id)).all()
    market_value = sum((Decimal(str(p.market_value)) for p in positions), start=Decimal('0'))
    account.market_value = market_value
    account.total_assets = (Decimal(str(account.cash)) + Decimal(str(account.frozen_cash)) + market_value).quantize(Decimal('0.01'))
    account.total_profit = (account.total_assets - Decimal(str(account.initial_cash))).quantize(Decimal('0.01'))
    if Decimal(str(account.initial_cash)) > 0:
        account.total_return = (account.total_profit / Decimal(str(account.initial_cash))).quantize(Decimal('0.000001'))
    return account
