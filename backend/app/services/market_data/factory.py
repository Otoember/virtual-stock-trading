from functools import lru_cache

from app.core.config import get_settings
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.services.market_data.akshare_provider import AKShareMarketDataProvider


@lru_cache
def get_market_provider() -> MarketDataProvider:
    """Return configured market data provider.

    Production/default mode uses AKShare for real A-share data.
    Set MARKET_PROVIDER=mock for offline development.
    """

    settings = get_settings()

    if settings.MARKET_PROVIDER.lower() == "mock":
        return MockMarketDataProvider()

    return AKShareMarketDataProvider()
