from datetime import datetime, date, timezone
from decimal import Decimal
import logging
from time import monotonic
from zoneinfo import ZoneInfo
from requests.exceptions import Timeout as RequestTimeout

from app.core.exceptions import AppError
from app.schemas.market import MarketStatus, StockHistoryItem, StockQuote, StockSearchItem
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.cache import CacheBusyError, MemoryTTLCache
from app.services.market_data.tencent_quote import get_tencent_quote, market_symbol

logger = logging.getLogger(__name__)


class AKShareMarketDataProvider(MarketDataProvider):
    """AKShare数据适配层。

    股票池按需加载并在进程内缓存一小时，不回退到模拟搜索结果。
    """

    name = 'akshare'
    STOCK_POOL_TTL = 3600

    QUOTE_TTL = 60

    def __init__(self, cache=None):
        self._ak = self._import_akshare()
        self.cache = cache or MemoryTTLCache(ttl=self.QUOTE_TTL)
        self.available = None

    @staticmethod
    def _import_akshare():
        import akshare as ak
        return ak

    def _timed(self, operation, fn):
        start = monotonic()
        try:
            return fn()
        finally:
            logger.info('Market upstream operation=%s elapsed_ms=%.1f', operation, (monotonic() - start) * 1000)

    def _fetch_stock_pool(self):
        df = self._timed('akshare.stock_info_a_code_name', self._ak.stock_info_a_code_name)
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
        df = df.drop_duplicates('code').sort_values('code')
        logger.info('AKShare loaded %d A-share stocks', len(df))
        return df

    def _load_stock_pool(self):
        df = self.cache.get_or_load('stock_pool', self._fetch_stock_pool, ttl=self.STOCK_POOL_TTL, timeout=45)
        self.available = True
        return df

    def is_available(self) -> bool:
        try:
            self._load_stock_pool()
            return True
        except Exception as exc:
            self.available = False
            logger.exception('AKShare error checking stock pool: %s', exc)
            return False

    def get_quote(self, symbol: str) -> StockQuote | None:
        try:
            market_symbol(symbol)
        except ValueError:
            return None
        try:
            return self.cache.get_or_load('quote:' + symbol, lambda: self._fetch_quote(symbol))
        except (TimeoutError, RequestTimeout) as exc:
            raise AppError('MARKET_DATA_TIMEOUT', '行情数据请求超时，请稍后重试', 504) from exc
        except CacheBusyError as exc:
            raise AppError('MARKET_DATA_BUSY', '行情服务繁忙，请稍后重试', 503) from exc
        except Exception as exc:
            logger.exception('AKShare error fetching quote for %s: %s', symbol, exc)
            raise AppError('MARKET_DATA_UNAVAILABLE', '行情数据源暂时不可用，请稍后重试', 503) from exc

    def _fetch_quote(self, symbol: str) -> StockQuote:
        try:
            # A single-stock AKShare request, never the 5,000+ stock snapshot.
            df = self._timed('akshare.stock_individual_spot_xq:' + symbol, lambda: self._ak.stock_individual_spot_xq(
                symbol=market_symbol(symbol).upper(), timeout=1.2,
            ))
            row = dict(zip(df['item'], df['value']))
            if row['代码'].upper() != market_symbol(symbol).upper():
                raise ValueError('AKShare returned a different symbol')
            timestamp = datetime.fromisoformat(str(row['时间']))
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=ZoneInfo('Asia/Shanghai'))
            quote = StockQuote(
                symbol=symbol, name=str(row['名称']), price=Decimal(str(row['现价'])),
                change=Decimal(str(row['涨跌'])), change_percent=Decimal(str(row['涨幅'])),
                volume=int(Decimal(str(row['成交量'])) / 100),  # Xueqiu shares -> lots
                updated_at=timestamp, source='akshare-xueqiu',
            )
            if quote.price <= 0 or quote.volume < 0:
                raise ValueError('AKShare quote is suspended or unavailable')
            return quote
        except Exception as exc:
            logger.warning('AKShare single-stock quote failed symbol=%s; using Tencent fallback: %s', symbol, exc, exc_info=True)
        return self._timed('tencent.single_quote:' + symbol, lambda: get_tencent_quote(symbol))

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
            df = self._timed('akshare.stock_zh_a_hist:' + symbol, lambda: ak.stock_zh_a_hist(
                symbol=symbol,
                period="daily",
                start_date=start.strftime("%Y%m%d"),
                end_date=end.strftime("%Y%m%d"),
                adjust="qfq"
            ))

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
