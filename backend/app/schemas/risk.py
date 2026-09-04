from pydantic import BaseModel


class RiskMetrics(BaseModel):
    total_return: float
    volatility: float
    max_drawdown: float
    sharpe_ratio: float
