from fastapi import APIRouter

from app.schemas.analytics import IndicatorRequest
from app.services.analytics import calculate_ma, calculate_macd, calculate_rsi

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/ma")
def ma(request: IndicatorRequest):
    return {
        "name": "MA",
        "values": calculate_ma(request.prices, request.period),
    }


@router.post("/rsi")
def rsi(request: IndicatorRequest):
    return {
        "name": "RSI",
        "values": calculate_rsi(request.prices, request.period),
    }


@router.post("/macd")
def macd(request: IndicatorRequest):
    return calculate_macd(request.prices)
