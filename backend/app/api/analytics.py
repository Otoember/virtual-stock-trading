from fastapi import APIRouter

from app.schemas.analytics import IndicatorRequest, RiskRequest
from app.services.analytics import calculate_ma, calculate_macd, calculate_rsi
from app.services.analytics.risk import PortfolioRiskService

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


@router.post("/risk")
def risk(request: RiskRequest):
    return {
        "return": PortfolioRiskService.calculate_returns(request.values),
        "volatility": PortfolioRiskService.calculate_volatility(request.values),
        "max_drawdown": PortfolioRiskService.calculate_max_drawdown(request.values),
        "sharpe": PortfolioRiskService.calculate_sharpe_ratio(request.values),
    }
