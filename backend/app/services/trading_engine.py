from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.models import (
    Account,
    DailyAssetSnapshot,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
    Trade,
    TradingDayState,
    User,
)
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

    @staticmethod
    def _money(value: Decimal | str | int | float) -> Decimal:
        return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    @staticmethod
    def _price(value: Decimal | str | int | float) -> Decimal:
        return Decimal(str(value)).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

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
            .where(DailyAssetSnapshot.user_id == user_id, DailyAssetSnapshot.date < today)
            .order_by(DailyAssetSnapshot.date.desc())
        )
        prev_assets = Decimal(str(prev.total_assets)) if prev else Decimal(str(account.initial_cash))
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

    def _ensure_account(self, db: Session, user_id: int) -> Account:
        account = db.scalar(select(Account).where(Account.user_id == user_id).with_for_update())
        if account is None:
            raise AppError('INTERNAL_ERROR', '账户不存在', 500)
        return account

    def _ensure_position(self, db: Session, user_id: int, symbol: str) -> Position | None:
        return db.scalar(select(Position).where(Position.user_id == user_id, Position.symbol == symbol).with_for_update())

    def _create_buy_position(self, db: Session, user_id: int, symbol: str, stock_name: str) -> Position:
        position = Position(
            user_id=user_id,
            symbol=symbol,
            stock_name=stock_name,
            total_quantity=0,
            available_quantity=0,
            today_bought_quantity=0,
            avg_cost=Decimal('0'),
        )
        db.add(position)
        db.flush()
        return position

    def _update_position_price(self, position: Position, market_price: Decimal) -> None:
        position.current_price = self._price(market_price)
        position.market_value = self._money(position.current_price * position.total_quantity)
        cost_basis = Decimal(str(position.avg_cost)) * position.total_quantity
        position.unrealized_profit = self._money(position.market_value - cost_basis)
        position.unrealized_return = (
            (position.unrealized_profit / cost_basis).quantize(Decimal('0.000001')) if cost_basis > 0 else Decimal('0')
        )

    def _release_remaining_buy_reserve(self, account: Account, order: Order) -> None:
        if order.reserved_cash <= 0:
            return
        reserved = self._money(order.reserved_cash)
        account.frozen_cash = self._money(Decimal(str(account.frozen_cash)) - reserved)
        account.cash = self._money(Decimal(str(account.cash)) + reserved)
        order.reserved_cash = Decimal('0')

    def _can_match_limit(self, side: OrderSide, limit_price: Decimal, market_price: Decimal) -> bool:
        if side == OrderSide.BUY:
            return market_price <= limit_price
        return market_price >= limit_price

    def _fill_order(self, db: Session, account: Account, order: Order, position: Position | None, execution_price: Decimal, quantity: int) -> Position:
        if quantity <= 0 or quantity > order.remaining_quantity:
            raise AppError('INVALID_QUANTITY', '成交数量无效', 400)

        fill_price = self._price(execution_price)
        gross_amount = self._money(fill_price * quantity)
        fee = self.fee_calculator.calculate(order.side.value, gross_amount)

        if order.side == OrderSide.BUY:
            if position is None:
                position = self._create_buy_position(db, order.user_id, order.symbol, order.stock_name)
            self._roll_t1_if_new_day(db, order.user_id, position)

            fill_total = self._money(gross_amount + fee)
            if order.order_type == OrderType.LIMIT:
                remaining_before = order.remaining_quantity
                if remaining_before == quantity:
                    reserved_for_fill = Decimal(str(order.reserved_cash))
                else:
                    reserved_for_fill = self._money((Decimal(str(order.reserved_cash)) * Decimal(quantity)) / Decimal(remaining_before))
                account.frozen_cash = self._money(Decimal(str(account.frozen_cash)) - reserved_for_fill)
                order.reserved_cash = self._money(Decimal(str(order.reserved_cash)) - reserved_for_fill)
                if reserved_for_fill >= fill_total:
                    refund = self._money(reserved_for_fill - fill_total)
                    if refund > 0:
                        account.cash = self._money(Decimal(str(account.cash)) + refund)
                else:
                    extra = self._money(fill_total - reserved_for_fill)
                    if Decimal(str(account.cash)) < extra:
                        raise AppError('INSUFFICIENT_FUNDS', '可用资金不足', 400)
                    account.cash = self._money(Decimal(str(account.cash)) - extra)
            else:
                if Decimal(str(account.cash)) < fill_total:
                    raise AppError('INSUFFICIENT_FUNDS', '可用资金不足', 400)
                account.cash = self._money(Decimal(str(account.cash)) - fill_total)

            prior_qty = position.total_quantity
            new_qty = prior_qty + quantity
            old_cost_total = Decimal(str(position.avg_cost)) * prior_qty
            new_cost_total = old_cost_total + gross_amount + fee
            position.total_quantity = new_qty
            position.today_bought_quantity += quantity
            position.avg_cost = (new_cost_total / new_qty).quantize(Decimal('0.0001'))
        else:
            if position is None:
                raise AppError('INSUFFICIENT_POSITION', '持仓不足', 400)
            self._roll_t1_if_new_day(db, order.user_id, position)
            if order.order_type == OrderType.MARKET:
                if position.available_quantity < quantity:
                    if position.total_quantity >= quantity:
                        raise AppError('T1_RESTRICTION', 'T+1限制，今日买入仓位不可卖', 400)
                    raise AppError('INSUFFICIENT_POSITION', '可卖持仓不足', 400)
                position.available_quantity -= quantity

            if position.total_quantity < quantity:
                raise AppError('INSUFFICIENT_POSITION', '持仓不足', 400)

            position.total_quantity -= quantity
            net = self._money(gross_amount - fee)
            account.cash = self._money(Decimal(str(account.cash)) + net)
            realized = (fill_price - Decimal(str(position.avg_cost))) * quantity - fee
            position.realized_profit = self._money(Decimal(str(position.realized_profit)) + realized)
            if position.total_quantity == 0:
                position.avg_cost = Decimal('0')

        self._update_position_price(position, fill_price)

        order.filled_quantity += quantity
        order.remaining_quantity -= quantity
        order.actual_amount = self._money(Decimal(str(order.actual_amount)) + gross_amount)
        order.fee = self._money(Decimal(str(order.fee)) + fee)
        order.status = OrderStatus.FILLED if order.remaining_quantity == 0 else OrderStatus.PARTIALLY_FILLED
        if order.order_type == OrderType.LIMIT and order.side == OrderSide.BUY and order.remaining_quantity == 0:
            self._release_remaining_buy_reserve(account, order)

        trade = Trade(
            order_id=order.id,
            user_id=order.user_id,
            symbol=order.symbol,
            side=order.side,
            price=fill_price,
            quantity=quantity,
            gross_amount=gross_amount,
            fee=fee,
            net_amount=self._money(gross_amount + fee) if order.side == OrderSide.BUY else self._money(gross_amount - fee),
        )
        db.add(trade)
        return position

    def place_order(self, db: Session, user: User, payload: PlaceOrderRequest, idem_key: str) -> Order:
        if not idem_key:
            raise AppError('ORDER_DUPLICATED', '缺少幂等键', 400)
        if not self.calendar.is_open():
            raise AppError('MARKET_CLOSED', '当前非交易时间', 400)

        self._validate_symbol(payload.symbol)
        if payload.quantity <= 0 or payload.quantity % 100 != 0:
            raise AppError('INVALID_QUANTITY', '买入数量需为100股整数倍', 400)

        try:
            side = OrderSide(payload.side.upper())
        except ValueError as exc:
            raise AppError('INVALID_ORDER_SIDE', '交易方向错误', 400) from exc

        try:
            order_type = OrderType(payload.order_type.upper())
        except ValueError as exc:
            raise AppError('INVALID_ORDER_TYPE', '订单类型错误', 400) from exc

        if order_type == OrderType.LIMIT and (payload.limit_price is None or Decimal(str(payload.limit_price)) <= 0):
            raise AppError('INVALID_LIMIT_PRICE', '限价单必须提供有效价格', 400)

        quote = self.provider.get_quote(payload.symbol)
        if not quote:
            raise AppError('PRICE_UNAVAILABLE', '行情数据暂时不可用', 400)
        market_price = self._price(quote.price)

        existing = db.scalar(select(Order).where(Order.user_id == user.id, Order.idempotency_key == idem_key))
        if existing:
            raise AppError('ORDER_DUPLICATED', '重复订单请求', 409, {'order_id': existing.id})

        account = self._ensure_account(db, user.id)
        position = self._ensure_position(db, user.id, payload.symbol)

        if side == OrderSide.SELL:
            if position is None:
                raise AppError('INSUFFICIENT_POSITION', '持仓不足', 400)
            self._roll_t1_if_new_day(db, user.id, position)

        order_price = market_price if order_type == OrderType.MARKET else self._price(payload.limit_price or 0)
        estimated_amount = self._money(order_price * payload.quantity)
        estimated_fee = self.fee_calculator.calculate(side.value, estimated_amount)

        order = Order(
            user_id=user.id,
            symbol=quote.symbol,
            stock_name=quote.name,
            side=side,
            order_type=order_type,
            price=order_price,
            limit_price=order_price if order_type == OrderType.LIMIT else None,
            quantity=payload.quantity,
            filled_quantity=0,
            remaining_quantity=payload.quantity,
            status=OrderStatus.PENDING,
            estimated_amount=estimated_amount,
            actual_amount=Decimal('0'),
            fee=Decimal('0'),
            reserved_cash=Decimal('0'),
            idempotency_key=idem_key,
        )

        if order_type == OrderType.LIMIT:
            if side == OrderSide.BUY:
                reserve_cash = self._money(estimated_amount + estimated_fee)
                if Decimal(str(account.cash)) < reserve_cash:
                    raise AppError('INSUFFICIENT_FUNDS', '可用资金不足', 400)
                account.cash = self._money(Decimal(str(account.cash)) - reserve_cash)
                account.frozen_cash = self._money(Decimal(str(account.frozen_cash)) + reserve_cash)
                order.reserved_cash = reserve_cash
            else:
                if position.available_quantity < payload.quantity:
                    if position.total_quantity >= payload.quantity:
                        raise AppError('T1_RESTRICTION', 'T+1限制，今日买入仓位不可卖', 400)
                    raise AppError('INSUFFICIENT_POSITION', '可卖持仓不足', 400)
                position.available_quantity -= payload.quantity

        db.add(order)
        db.flush()

        if order_type == OrderType.MARKET:
            position = self._fill_order(db, account, order, position, market_price, payload.quantity)
            order.price = market_price
        elif self._can_match_limit(side, order_price, market_price):
            position = self._fill_order(db, account, order, position, market_price, payload.quantity)

        refresh_account_assets(db, user.id)
        self._snapshot(db, user.id, account)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise AppError('ORDER_DUPLICATED', '重复订单请求', 409)
        db.refresh(order)
        return order

    def cancel_order(self, db: Session, user: User, order_id: int) -> Order:
        order = db.scalar(select(Order).where(Order.id == order_id, Order.user_id == user.id).with_for_update())
        if order is None:
            raise AppError('ORDER_NOT_FOUND', '订单不存在', 404)
        if order.status not in {OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED}:
            raise AppError('ORDER_NOT_CANCELLABLE', '当前状态不可撤单', 400)

        account = self._ensure_account(db, user.id)
        position = self._ensure_position(db, user.id, order.symbol)

        if order.side == OrderSide.BUY and Decimal(str(order.reserved_cash)) > 0:
            self._release_remaining_buy_reserve(account, order)
        elif order.side == OrderSide.SELL and order.remaining_quantity > 0 and position is not None:
            self._roll_t1_if_new_day(db, user.id, position)
            position.available_quantity += order.remaining_quantity

        order.status = OrderStatus.CANCELLED
        order.cancelled_at = datetime.utcnow()
        order.remaining_quantity = 0

        refresh_account_assets(db, user.id)
        self._snapshot(db, user.id, account)
        db.commit()
        db.refresh(order)
        return order

    def match_pending_orders(self, db: Session, user: User) -> list[Order]:
        account = self._ensure_account(db, user.id)
        pending_orders = db.scalars(
            select(Order)
            .where(
                Order.user_id == user.id,
                Order.order_type == OrderType.LIMIT,
                Order.status.in_([OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED]),
                Order.remaining_quantity > 0,
            )
            .order_by(Order.created_at.asc())
            .with_for_update()
        ).all()

        quote_cache: dict[str, Decimal] = {}
        touched_symbols: set[str] = set()
        for order in pending_orders:
            price = quote_cache.get(order.symbol)
            if price is None:
                quote = self.provider.get_quote(order.symbol)
                if not quote:
                    continue
                price = self._price(quote.price)
                quote_cache[order.symbol] = price
            if order.limit_price is None or not self._can_match_limit(order.side, Decimal(str(order.limit_price)), price):
                continue

            position = self._ensure_position(db, user.id, order.symbol)
            position = self._fill_order(db, account, order, position, price, order.remaining_quantity)
            touched_symbols.add(order.symbol)
            if position is not None:
                touched_symbols.add(position.symbol)

        if pending_orders:
            refresh_account_assets(db, user.id)
            self._snapshot(db, user.id, account)
            db.commit()
            for order in pending_orders:
                db.refresh(order)

        return pending_orders
