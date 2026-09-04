from datetime import date, timedelta

from app.core.exceptions import AppError
from app.services.market_data.factory import get_market_provider


class MarketDataService:
    """统一行情业务入口。

    将 API 层与具体数据供应商隔离，后续接入 AKShare/Tushare/缓存时
    不需要修改上层业务。
    """

    def __init__(self, provider=None):
        self.provider = provider or get_market_provider()

    def search(self, keyword: str):
        keyword = keyword.strip()
        if not keyword:
            return []
        result = self.provider.search_stock(keyword)
        if getattr(self.provider, 'available', None) is False:
            raise AppError('MARKET_DATA_UNAVAILABLE', 'A股数据源暂时不可用，请稍后重试', 503)
        return result

    def provider_status(self):
        return {'provider': self.provider.name, 'available': self.provider.is_available()}

    def quote(self, symbol: str):
        return self.provider.get_quote(symbol)

    def history(self, symbol: str, start: date | None = None, end: date | None = None):
        end = end or date.today()
        start = start or end - timedelta(days=30)
        return self.provider.get_history(symbol, start, end)

    def info(self, symbol: str):
        return self.provider.get_stock_info(symbol)
