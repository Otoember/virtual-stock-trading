from pydantic import BaseModel


class IndicatorRequest(BaseModel):
    prices: list[float]
    period: int = 20


class IndicatorResponse(BaseModel):
    name: str
    values: list[float | None]
