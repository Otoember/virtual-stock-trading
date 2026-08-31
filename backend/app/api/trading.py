from fastapi import APIRouter, Depends, Header
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.db.session import get_db
from app.models import Account, DailyAssetSnapshot, Order, Position, Trade, User
from app.schemas.trading import (
    AccountResponse,
    AssetSnapshotResponse,
    LeaderboardRow,
    OrderResponse,
    PlaceOrderRequest,
    PositionResponse,
    TradeResponse,
)
from app.services.market_data.factory import get_market_provider
from app.services.trading_engine import TradingEngine

router = APIRouter(tags=['trading'])


@router.post('/orders', response_model=OrderResponse)
def place_order(
    payload: PlaceOrderRequest,
    idempotency_key: str | None = Header(default=None, alias='Idempotency-Key'),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    provider=Depends(get_market_provider),
):
    if not idempotency_key:
        raise AppError('ORDER_DUPLICATED', '必须提供 Idempotency-Key', 400)
    engine = TradingEngine(provider)
    order = engine.place_market_order(db, current_user, payload, idempotency_key)
    return OrderResponse.model_validate(order, from_attributes=True)


@router.get('/orders', response_model=list[OrderResponse])
def get_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(select(Order).where(Order.user_id == current_user.id).order_by(desc(Order.created_at)).limit(200)).all()
    return [OrderResponse.model_validate(x, from_attributes=True) for x in rows]


@router.get('/trades', response_model=list[TradeResponse])
def get_trades(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(select(Trade).where(Trade.user_id == current_user.id).order_by(desc(Trade.executed_at)).limit(200)).all()
    return [TradeResponse.model_validate(x, from_attributes=True) for x in rows]


@router.get('/portfolio', response_model=list[PositionResponse])
def get_portfolio(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(select(Position).where(Position.user_id == current_user.id)).all()
    return [PositionResponse.model_validate(x, from_attributes=True) for x in rows]


@router.get('/account', response_model=AccountResponse)
def get_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    account = db.scalar(select(Account).where(Account.user_id == current_user.id))
    if not account:
        raise AppError('INTERNAL_ERROR', '账户不存在', 500)
    return AccountResponse.model_validate(account, from_attributes=True)


@router.get('/assets/history', response_model=list[AssetSnapshotResponse])
def get_assets_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.scalars(select(DailyAssetSnapshot).where(DailyAssetSnapshot.user_id == current_user.id).order_by(DailyAssetSnapshot.date)).all()
    return [AssetSnapshotResponse.model_validate(x, from_attributes=True) for x in rows]


@router.get('/leaderboard', response_model=list[LeaderboardRow])
def leaderboard(db: Session = Depends(get_db)):
    rows = db.execute(
        select(User.username, Account.total_assets, Account.total_return)
        .join(Account, Account.user_id == User.id)
        .order_by(desc(Account.total_return), desc(Account.total_assets))
        .limit(100)
    ).all()
    today_return = {r.username: r.total_return for r in rows}
    output = []
    for idx, row in enumerate(rows, 1):
        output.append(
            LeaderboardRow(
                rank=idx,
                username=row.username,
                total_assets=row.total_assets,
                cumulative_return=row.total_return,
                daily_return=today_return[row.username],
            )
        )
    return output
