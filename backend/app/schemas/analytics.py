from pydantic import BaseModel


class IndicatorRequest(BaseModel):
    prices: list[float]
    period: int = 20


class IndicatorResponse(BaseModel):
    name: str
    values: list[float | None]


class RiskRequest(BaseModel):
    """Portfolio value history for risk evaluation."""

    values: list[float]
    risk_free_rate: float = 0.0
