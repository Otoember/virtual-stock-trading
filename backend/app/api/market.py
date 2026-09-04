from datetime import date, timedelta
from fastapi import APIRouter, Depends
from app.core.exceptions import AppError
from app.schemas.market import MarketStatus, StockHistoryItem, StockQuote, StockSearchItem
from app.services.market_data.factory import get_market_provider
from app.services.market_data.service import MarketDataService

router = APIRouter(prefix='/market', tags=['market'])


@router.get('/search', response_model=list[StockSearchItem])
def search(keyword: str, provider=Depends(get_market_provider)):
    return MarketDataService(provider).search(keyword)


@router.get('/provider')
def provider_status(provider=Depends(get_market_provider)):
    return MarketDataService(provider).provider_status()


@router.get('/quote/{symbol}', response_model=StockQuote)
def quote(symbol: str, provider=Depends(get_market_provider)):
    result = provider.get_quote(symbol)
    if not result:
        raise AppError('INVALID_SYMBOL', '股票不存在', 404)
    return result


@router.get('/history/{symbol}', response_model=list[StockHistoryItem])
def history(symbol: str, start: date | None = None, end: date | None = None, provider=Depends(get_market_provider)):
    end = end or date.today()
    start = start or (end - timedelta(days=30))
    return provider.get_history(symbol, start, end)


@router.get('/status', response_model=MarketStatus)
def status(provider=Depends(get_market_provider)):
    return provider.get_market_status()
