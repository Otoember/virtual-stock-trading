import logging
from functools import lru_cache

from app.core.config import get_settings
from app.services.market_data.akshare_provider import AKShareMarketDataProvider
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.mock_provider import MockMarketDataProvider

logger = logging.getLogger(__name__)


@lru_cache
def get_market_provider() -> MarketDataProvider:
    provider = get_settings().MARKET_PROVIDER.strip().lower()
    if provider == 'mock':
        logger.warning('Market provider: mock (explicitly configured)')
        return MockMarketDataProvider()
    try:
        result = AKShareMarketDataProvider()
        logger.info('Market provider: akshare')
        return result
    except Exception as exc:
        logger.exception('AKShare initialization error: %s; falling back to mock', exc)
        return MockMarketDataProvider()
