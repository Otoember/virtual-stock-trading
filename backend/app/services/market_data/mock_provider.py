from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from random import Random
from app.schemas.market import MarketStatus, StockHistoryItem, StockQuote, StockSearchItem
from app.services.market_data.base import MarketDataProvider

MOCK_STOCKS = {
    '600519': '贵州茅台',
    '000001': '平安银行',
    '600036': '招商银行',
    '300750': '宁德时代',
    '600000': '浦发银行',
}


class MockMarketDataProvider(MarketDataProvider):
    name = 'mock'

    def _quote(self, symbol: str) -> StockQuote | None:
        name = MOCK_STOCKS.get(symbol)
        if not name:
            return None
        rnd = Random(symbol)
        base = Decimal(str(10 + rnd.randint(0, 2000) / 10))
        drift = Decimal(str((datetime.now(timezone.utc).minute % 20 - 10) / 10))
        price = (base + drift).quantize(Decimal('0.01'))
        change = Decimal(str((rnd.randint(-500, 500)) / 100)).quantize(Decimal('0.01'))
        pct = ((change / base) * Decimal('100')).quantize(Decimal('0.01'))
        return StockQuote(
            symbol=symbol,
            name=name,
            price=price,
            change=change,
            change_percent=pct,
            volume=1_000_000 + rnd.randint(0, 500_000),
            updated_at=datetime.now(timezone.utc),
        )

    def get_quote(self, symbol: str) -> StockQuote | None:
        return self._quote(symbol)

    def get_quotes(self, symbols: list[str]) -> list[StockQuote]:
        return [q for s in symbols if (q := self._quote(s))]

    def search_stock(self, keyword: str) -> list[StockSearchItem]:
        keyword = keyword.strip().lower()
        return [
            StockSearchItem(symbol=symbol, name=name)
            for symbol, name in MOCK_STOCKS.items()
            if keyword in symbol.lower() or keyword in name.lower()
        ]

    def get_stock_info(self, symbol: str) -> StockSearchItem | None:
        name = MOCK_STOCKS.get(symbol)
        if not name:
            return None
        return StockSearchItem(symbol=symbol, name=name)

    def get_history(self, symbol: str, start: date, end: date) -> list[StockHistoryItem]:
        if symbol not in MOCK_STOCKS:
            return []
        rnd = Random(symbol)
        price = Decimal(str(10 + rnd.randint(0, 1000) / 10))
        cursor = start
        out: list[StockHistoryItem] = []
        while cursor <= end:
            delta = Decimal(str((rnd.randint(-30, 30)) / 100))
            open_price = price
            close = max(Decimal('1'), (open_price + delta)).quantize(Decimal('0.01'))
            high = max(open_price, close) + Decimal('0.08')
            low = max(Decimal('0.5'), min(open_price, close) - Decimal('0.08'))
            out.append(
                StockHistoryItem(
                    date=cursor,
                    open=open_price.quantize(Decimal('0.01')),
                    high=high.quantize(Decimal('0.01')),
                    low=low.quantize(Decimal('0.01')),
                    close=close,
                    volume=700_000 + rnd.randint(0, 200_000),
                )
            )
            price = close
            cursor += timedelta(days=1)
        return out

    def get_market_status(self) -> MarketStatus:
        return MarketStatus(is_open=True, timezone='Asia/Shanghai', updated_at=datetime.now(timezone.utc))
