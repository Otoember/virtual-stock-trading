from fastapi import APIRouter

from app.schemas.risk import RiskMetrics
from app.services.analytics.risk import (
    calculate_max_drawdown,
    calculate_sharpe_ratio,
    calculate_volatility,
)

router = APIRouter(prefix='/risk', tags=['Risk Analytics'])


@router.post('/metrics', response_model=RiskMetrics)
def risk_metrics(values: list[float]):
    total_return = 0.0
    if len(values) >= 2 and values[0] != 0:
        total_return = (values[-1] - values[0]) / values[0]

    return RiskMetrics(
        total_return=total_return,
        volatility=calculate_volatility(values),
        max_drawdown=calculate_max_drawdown(values),
        sharpe_ratio=calculate_sharpe_ratio(values),
    )
