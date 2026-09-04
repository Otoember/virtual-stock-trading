from pydantic import BaseModel


class PortfolioAnalyticsRequest(BaseModel):
    asset_values: list[float]
    positions: list[dict] = []


class PortfolioAnalyticsResponse(BaseModel):
    return_rate: float
    volatility: float
    max_drawdown: float
    sharpe_ratio: float
    industry_distribution: dict = {}
