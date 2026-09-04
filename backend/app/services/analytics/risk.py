from __future__ import annotations

from math import sqrt
from statistics import mean, stdev


class PortfolioRiskService:
    """Portfolio risk metrics service.

    Independent from database layer so it can be reused by
    portfolio dashboard, backtesting and AI analysis modules.
    """

    @staticmethod
    def calculate_returns(values: list[float]) -> list[float]:
        if len(values) < 2:
            return []
        return [
            (values[i] - values[i - 1]) / values[i - 1]
            for i in range(1, len(values))
            if values[i - 1] != 0
        ]

    @staticmethod
    def calculate_volatility(values: list[float]) -> float:
        returns = PortfolioRiskService.calculate_returns(values)
        if len(returns) < 2:
            return 0.0
        return stdev(returns) * sqrt(252)

    @staticmethod
    def calculate_max_drawdown(values: list[float]) -> float:
        if not values:
            return 0.0
        peak = values[0]
        max_drawdown = 0.0
        for value in values:
            peak = max(peak, value)
            if peak:
                max_drawdown = min(max_drawdown, (value - peak) / peak)
        return max_drawdown

    @staticmethod
    def calculate_sharpe_ratio(values: list[float], risk_free_rate: float = 0.0) -> float:
        returns = PortfolioRiskService.calculate_returns(values)
        if len(returns) < 2:
            return 0.0
        excess = [r - risk_free_rate / 252 for r in returns]
        deviation = stdev(excess)
        if deviation == 0:
            return 0.0
        return mean(excess) / deviation * sqrt(252)
