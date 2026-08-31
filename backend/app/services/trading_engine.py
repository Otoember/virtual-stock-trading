from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.models import Account, DailyAssetSnapshot, Order, OrderSide, OrderStatus, OrderType, Position, Trade, TradingDayState, User
from app.schemas.trading import PlaceOrderRequest
from app.services.account_service import refresh_account_assets
from app.services.fee_calculator import FeeCalculator
from app.services.market_data.base import MarketDataProvider
from app.services.trading_calendar import TradingCalendar


class TradingEngine:
    def __init__(self, provider: MarketDataProvider):
        self.provider = provider
        self.calendar = TradingCalendar()
        self.fee_calculator = FeeCalculator()
        self.settings = get_settings()

    def _validate_symbol(self, symbol: str) -> None:
        if not symbol.isdigit() or len(symbol) != 6:
            raise AppError('INVALID_SYMBOL', '股票代码无效', 400)

    def _roll_t1_if_new_day(self, db: Session, user_id: int, position: Position) -> None:
        state = db.scalar(select(TradingDayState).where(TradingDayState.user_id == user_id, TradingDayState.symbol == position.symbol))
        today = self.calendar.now_local().date()
        if state is None:
            db.add(TradingDayState(user_id=user_id, symbol=position.symbol, last_trade_date=today))
            return
        if state.last_trade_date < today:
            position.available_quantity += position.today_bought_quantity
            position.today_bought_quantity = 0
            state.last_trade_date = today

    def _snapshot(self, db: Session, user_id: int, account: Account):
        today = self.calendar.now_local().date()
        prev = db.scalar(
            select(DailyAssetSnapshot)
            .where(DailyAssetSnapshot.user_id == user_id)
            .order_by(DailyAssetSnapshot.date.desc())
        )
        prev_assets = Decimal(str(prev.total_assets)) if prev and prev.date < today else Decimal(str(account.initial_cash))
        daily_profit = Decimal(str(account.total_assets)) - prev_assets
        daily_return = (daily_profit / prev_assets).quantize(Decimal('0.000001')) if prev_assets > 0 else Decimal('0')
        snap = db.scalar(select(DailyAssetSnapshot).where(DailyAssetSnapshot.user_id == user_id, DailyAssetSnapshot.date == today))
        if snap is None:
            snap = DailyAssetSnapshot(
                user_id=user_id,
                date=today,
                cash=account.cash,
                market_value=account.market_value,
                total_assets=account.total_assets,
                daily_profit=daily_profit,
                daily_return=daily_return,
                cumulative_profit=account.total_profit,
                cumulative_return=account.total_return,
            )
            db.add(snap)
        else:
            snap.cash = account.cash
            snap.market_value = account.market_value
            snap.total_assets = account.total_assets
            snap.daily_profit = daily_profit
            snap.daily_return = daily_return
            snap.cumulative_profit = account.total_profit
            snap.cumulative_return = account.total_return

    def place_market_order(self, db: Session, user: User, payload: PlaceOrderRequest, idem_key: str) -> Order:
        if not idem_key:
            raise AppError('ORDER_DUPLICATED', '缺少幂等键', 400)
        if not self.calendar.is_open():
            raise AppError('MARKET_CLOSED', '当前非交易时间', 400)

        self._validate_symbol(payload.symbol)
        if payload.quantity <= 0 or payload.quantity % 100 != 0:
            raise AppError('INVALID_QUANTITY', '买入数量需为100股整数倍', 400)

        quote = self.provider.get_quote(payload.symbol)
        if not quote:
            raise AppError('PRICE_UNAVAILABLE', '行情数据暂时不可用', 400)

        existing = db.scalar(select(Order).where(Order.user_id == user.id, Order.idempotency_key == idem_key))
        if existing:
            raise AppError('ORDER_DUPLICATED', '重复订单请求', 409, {'order_id': existing.id})

        account = db.scalar(select(Account).where(Account.user_id == user.id).with_for_update())
        if account is None:
            raise AppError('INTERNAL_ERROR', '账户不存在', 500)

        amount = (Decimal(str(quote.price)) * payload.quantity).quantize(Decimal('0.01'))
        try:
            side = OrderSide(payload.side.upper())
        except ValueError as exc:
            raise AppError('INVALID_QUANTITY', '交易方向错误', 400) from exc

        fee = self.fee_calculator.calculate(side.value, amount)

        order = Order(
            user_id=user.id,
            symbol=quote.symbol,
            stock_name=quote.name,
            side=side,
            order_type=OrderType.MARKET,
            price=quote.price,
            quantity=payload.quantity,
            filled_quantity=payload.quantity,
            status=OrderStatus.FILLED,
            estimated_amount=amount,
            actual_amount=amount,
            fee=fee,
            idempotency_key=idem_key,
        )
        db.add(order)
        db.flush()

        position = db.scalar(select(Position).where(Position.user_id == user.id, Position.symbol == payload.symbol).with_for_update())

        if side == OrderSide.BUY:
            total_cost = amount + fee
            if Decimal(str(account.cash)) < total_cost:
                raise AppError('INSUFFICIENT_FUNDS', '可用资金不足', 400)
            account.cash = (Decimal(str(account.cash)) - total_cost).quantize(Decimal('0.01'))
            if position is None:
                position = Position(
                    user_id=user.id,
                    symbol=quote.symbol,
                    stock_name=quote.name,
                    total_quantity=0,
                    available_quantity=0,
                    today_bought_quantity=0,
                    avg_cost=Decimal('0'),
                )
                db.add(position)
                db.flush()
            self._roll_t1_if_new_day(db, user.id, position)
            prior_qty = position.total_quantity
            new_qty = prior_qty + payload.quantity
            old_cost_total = Decimal(str(position.avg_cost)) * prior_qty
            new_cost_total = old_cost_total + amount + fee
            position.total_quantity = new_qty
            position.today_bought_quantity += payload.quantity
            position.avg_cost = (new_cost_total / new_qty).quantize(Decimal('0.0001'))
        else:
            if position is None:
                raise AppError('INSUFFICIENT_POSITION', '持仓不足', 400)
            self._roll_t1_if_new_day(db, user.id, position)
            if position.available_quantity < payload.quantity:
                if position.total_quantity >= payload.quantity:
                    raise AppError('T1_RESTRICTION', 'T+1限制，今日买入仓位不可卖', 400)
                raise AppError('INSUFFICIENT_POSITION', '可卖持仓不足', 400)
            gross = amount
            net = gross - fee
            position.total_quantity -= payload.quantity
            position.available_quantity -= payload.quantity
            realized = (Decimal(str(quote.price)) - Decimal(str(position.avg_cost))) * payload.quantity - fee
            position.realized_profit = (Decimal(str(position.realized_profit)) + realized).quantize(Decimal('0.01'))
            account.cash = (Decimal(str(account.cash)) + net).quantize(Decimal('0.01'))
            if position.total_quantity == 0:
                position.avg_cost = Decimal('0')

        if position is not None:
            position.current_price = Decimal(str(quote.price))
            position.market_value = (Decimal(str(position.current_price)) * position.total_quantity).quantize(Decimal('0.01'))
            cost_basis = Decimal(str(position.avg_cost)) * position.total_quantity
            position.unrealized_profit = (position.market_value - cost_basis).quantize(Decimal('0.01'))
            position.unrealized_return = (
                (position.unrealized_profit / cost_basis).quantize(Decimal('0.000001')) if cost_basis > 0 else Decimal('0')
            )

        trade = Trade(
            order_id=order.id,
            user_id=user.id,
            symbol=quote.symbol,
            side=side,
            price=quote.price,
            quantity=payload.quantity,
            gross_amount=amount,
            fee=fee,
            net_amount=(amount + fee) if side == OrderSide.BUY else (amount - fee),
        )
        db.add(trade)

        refresh_account_assets(db, user.id)
        self._snapshot(db, user.id, account)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise AppError('ORDER_DUPLICATED', '重复订单请求', 409)
        db.refresh(order)
        return order
