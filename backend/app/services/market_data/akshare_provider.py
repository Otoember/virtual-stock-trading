from datetime import datetime, date, timezone
from decimal import Decimal
import logging

from app.schemas.market import MarketStatus, StockHistoryItem, StockQuote, StockSearchItem
from app.services.market_data.base import MarketDataProvider

logger = logging.getLogger(__name__)


class AKShareMarketDataProvider(MarketDataProvider):
    """AKShare数据适配层。"""

    def _import_akshare(self):
        try:
            import akshare as ak
            return ak
        except ImportError:
            logger.error("AKShare未安装")
            return None

    def get_quote(self, symbol: str) -> StockQuote | None:
        ak = self._import_akshare()
        if ak is None:
            return None

        try:
            df = ak.stock_zh_a_spot_em()
            row = df[df["代码"].astype(str) == symbol].iloc[0]
            return StockQuote(
                symbol=symbol,
                name=str(row["名称"]),
                price=Decimal(str(row["最新价"])),
                change=Decimal(str(row["涨跌额"])),
                change_percent=Decimal(str(row["涨跌幅"])),
                volume=int(row["成交量"]),
                updated_at=datetime.now(timezone.utc),
            )
        except Exception as e:
            logger.exception("获取股票行情失败 %s: %s", symbol, e)
            return None

    def get_quotes(self, symbols: list[str]) -> list[StockQuote]:
        return [q for s in symbols if (q := self.get_quote(s))]

    def search_stock(self, keyword: str) -> list[StockSearchItem]:
        ak = self._import_akshare()
        if ak is None:
            return []

        try:
            df = ak.stock_info_a_code_name()

            # 兼容AKShare字段变化
            code_col = "code" if "code" in df.columns else "代码"
            name_col = "name" if "name" in df.columns else "名称"

            df[code_col] = df[code_col].astype(str)
            df[name_col] = df[name_col].astype(str)

            result = df[
                df[code_col].str.contains(keyword, na=False)
                | df[name_col].str.contains(keyword, na=False)
            ]

            return [
                StockSearchItem(
                    symbol=str(r[code_col]),
                    name=str(r[name_col])
                )
                for _, r in result.head(50).iterrows()
            ]

        except Exception as e:
            logger.exception("股票搜索失败 keyword=%s: %s", keyword, e)
            return []

    def get_stock_info(self, symbol: str) -> StockSearchItem | None:
        items = self.search_stock(symbol)
        return items[0] if items else None

    def get_history(self, symbol: str, start: date, end: date) -> list[StockHistoryItem]:
        ak = self._import_akshare()
        if ak is None:
            return []

        try:
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period="daily",
                start_date=start.strftime("%Y%m%d"),
                end_date=end.strftime("%Y%m%d"),
                adjust="qfq"
            )

            return [
                StockHistoryItem(
                    date=r["日期"],
                    open=Decimal(str(r["开盘"])),
                    high=Decimal(str(r["最高"])),
                    low=Decimal(str(r["最低"])),
                    close=Decimal(str(r["收盘"])),
                    volume=int(r["成交量"]),
                )
                for _, r in df.iterrows()
            ]
        except Exception as e:
            logger.exception("历史行情获取失败 %s: %s", symbol, e)
            return []

    def get_market_status(self) -> MarketStatus:
        return MarketStatus(
            is_open=False,
            timezone="Asia/Shanghai",
            updated_at=datetime.now(timezone.utc)
        )
