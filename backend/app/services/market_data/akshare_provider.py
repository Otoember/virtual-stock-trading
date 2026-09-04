from datetime import datetime, date, timezone
from decimal import Decimal

from app.schemas.market import MarketStatus, StockHistoryItem, StockQuote, StockSearchItem
from app.services.market_data.base import MarketDataProvider


class AKShareMarketDataProvider(MarketDataProvider):
    """AKShare数据适配层。

    AKShare为可选依赖，未安装时保持系统可运行。
    业务层不直接依赖第三方库。
    """

    def _import_akshare(self):
        try:
            import akshare as ak
            return ak
        except ImportError:
            return None

    def get_quote(self, symbol: str) -> StockQuote | None:
        ak = self._import_akshare()
        if ak is None:
            return None

        try:
            df = ak.stock_zh_a_spot_em()
            row = df[df["代码"] == symbol].iloc[0]
            price = Decimal(str(row["最新价"]))
            change = Decimal(str(row["涨跌额"]))
            percent = Decimal(str(row["涨跌幅"]))
            return StockQuote(
                symbol=symbol,
                name=str(row["名称"]),
                price=price,
                change=change,
                change_percent=percent,
                volume=int(row["成交量"]),
                updated_at=datetime.now(timezone.utc),
            )
        except Exception:
            return None

    def get_quotes(self, symbols: list[str]) -> list[StockQuote]:
        return [q for s in symbols if (q := self.get_quote(s))]

    def search_stock(self, keyword: str) -> list[StockSearchItem]:
        ak = self._import_akshare()
        if ak is None:
            return []
        try:
            df = ak.stock_info_a_code_name()
            result = df[df["name"].str.contains(keyword, na=False) | df["code"].str.contains(keyword, na=False)]
            return [StockSearchItem(symbol=str(r["code"]), name=str(r["name"])) for _, r in result.head(20).iterrows()]
        except Exception:
            return []

    def get_stock_info(self, symbol: str) -> StockSearchItem | None:
        items = self.search_stock(symbol)
        return items[0] if items else None

    def get_history(self, symbol: str, start: date, end: date) -> list[StockHistoryItem]:
        ak = self._import_akshare()
        if ak is None:
            return []
        try:
            df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start.strftime("%Y%m%d"), end_date=end.strftime("%Y%m%d"), adjust="qfq")
            result = []
            for _, r in df.iterrows():
                result.append(StockHistoryItem(
                    date=r["日期"],
                    open=Decimal(str(r["开盘"])),
                    high=Decimal(str(r["最高"])),
                    low=Decimal(str(r["最低"])),
                    close=Decimal(str(r["收盘"])),
                    volume=int(r["成交量"]),
                ))
            return result
        except Exception:
            return []

    def get_market_status(self) -> MarketStatus:
        return MarketStatus(is_open=False, timezone="Asia/Shanghai", updated_at=datetime.now(timezone.utc))
