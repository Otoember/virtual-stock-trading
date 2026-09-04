from datetime import datetime, date, timezone
from decimal import Decimal
import logging
from threading import Lock
from time import monotonic

from app.schemas.market import MarketStatus, StockHistoryItem, StockQuote, StockSearchItem
from app.services.market_data.base import MarketDataProvider

logger = logging.getLogger(__name__)


class AKShareMarketDataProvider(MarketDataProvider):
    """AKShare数据适配层。

    股票池按需加载并在进程内缓存一小时，不回退到模拟搜索结果。
    """

    name = 'akshare'
    STOCK_POOL_TTL = 3600

    def __init__(self):
        self._ak = self._import_akshare()
        self._stock_pool = None
        self._stock_pool_expires = 0.0
        self._stock_pool_lock = Lock()
        self.available = None

    @staticmethod
    def _import_akshare():
        import akshare as ak
        return ak

    def _load_stock_pool(self):
        with self._stock_pool_lock:
            if self._stock_pool is None or monotonic() >= self._stock_pool_expires:
                df = self._ak.stock_info_a_code_name()
                if df.empty:
                    raise ValueError('AKShare returned an empty A-share stock pool')
                df = df.rename(columns={
                    col: target for col, target in [('代码', 'code'), ('名称', 'name')]
                    if target not in df.columns
                })
                df = df[['code', 'name']].dropna().copy()
                df['code'] = df['code'].astype(str).str.strip().str.zfill(6)
                df['name'] = df['name'].astype(str).str.strip()
                df = df[df['code'].str.fullmatch(r'\d{6}') & df['name'].ne('')]
                if df.empty:
                    raise ValueError('AKShare stock pool contains no valid stocks')
                self._stock_pool = df.drop_duplicates('code').sort_values('code')
                self._stock_pool_expires = monotonic() + self.STOCK_POOL_TTL
                logger.info('AKShare loaded %d A-share stocks', len(self._stock_pool))
            self.available = True
            return self._stock_pool

    def is_available(self) -> bool:
        try:
            self._load_stock_pool()
            return True
        except Exception as exc:
            self.available = False
            logger.exception('AKShare error checking stock pool: %s', exc)
            return False

    def get_quote(self, symbol: str) -> StockQuote | None:
        ak = self._ak
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
        except Exception as exc:
            logger.exception('AKShare error fetching quote for %s: %s', symbol, exc)
            return None

    def get_quotes(self, symbols: list[str]) -> list[StockQuote]:
        return [q for s in symbols if (q := self.get_quote(s))]

    def search_stock(self, keyword: str) -> list[StockSearchItem]:
        keyword = keyword.strip()
        if not keyword:
            return []

        try:
            df = self._load_stock_pool()
            result = df[
                df['name'].str.contains(keyword, na=False, regex=False, case=False)
                | df['code'].str.contains(keyword, na=False, regex=False)
            ]
            return [StockSearchItem(symbol=r['code'], name=r['name']) for _, r in result.head(50).iterrows()]
        except Exception as exc:
            self.available = False
            logger.exception('AKShare error searching stocks for %r: %s', keyword, exc)
            return []

    def get_stock_info(self, symbol: str) -> StockSearchItem | None:
        items = self.search_stock(symbol)
        return next((item for item in items if item.symbol == symbol), None)

    def get_history(self, symbol: str, start: date, end: date) -> list[StockHistoryItem]:
        ak = self._ak
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
        except Exception as exc:
            logger.exception('AKShare error fetching history for %s: %s', symbol, exc)
            return []

    def get_market_status(self) -> MarketStatus:
        return MarketStatus(
            is_open=False,
            timezone="Asia/Shanghai",
            updated_at=datetime.now(timezone.utc)
        )
