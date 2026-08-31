from abc import ABC, abstractmethod
from datetime import date
from app.schemas.market import StockHistoryItem, StockQuote, StockSearchItem, MarketStatus


class MarketDataProvider(ABC):
    @abstractmethod
    def get_quote(self, symbol: str) -> StockQuote | None:
        raise NotImplementedError

    @abstractmethod
    def get_quotes(self, symbols: list[str]) -> list[StockQuote]:
        raise NotImplementedError

    @abstractmethod
    def search_stock(self, keyword: str) -> list[StockSearchItem]:
        raise NotImplementedError

    @abstractmethod
    def get_stock_info(self, symbol: str) -> StockSearchItem | None:
        raise NotImplementedError

    @abstractmethod
    def get_history(self, symbol: str, start: date, end: date) -> list[StockHistoryItem]:
        raise NotImplementedError

    @abstractmethod
    def get_market_status(self) -> MarketStatus:
        raise NotImplementedError
