from datetime import datetime, date, timezone
from app.schemas.market import MarketStatus, StockHistoryItem, StockQuote, StockSearchItem
from app.services.market_data.base import MarketDataProvider


class AKShareMarketDataProvider(MarketDataProvider):
    def get_quote(self, symbol: str) -> StockQuote | None:
        return None

    def get_quotes(self, symbols: list[str]) -> list[StockQuote]:
        return []

    def search_stock(self, keyword: str) -> list[StockSearchItem]:
        return []

    def get_stock_info(self, symbol: str) -> StockSearchItem | None:
        return None

    def get_history(self, symbol: str, start: date, end: date) -> list[StockHistoryItem]:
        return []

    def get_market_status(self) -> MarketStatus:
        return MarketStatus(is_open=False, timezone='Asia/Shanghai', updated_at=datetime.now(timezone.utc))
