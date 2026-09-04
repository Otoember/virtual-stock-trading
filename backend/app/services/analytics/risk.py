from __future__ import annotations

from math import sqrt
from statistics import mean, stdev


class PortfolioRiskService:
    """
    Portfolio risk metrics service.

    Independent from database layer so it can be reused by:
    - portfolio dashboard
    - backtesting
    - AI analysis modules
    """

    @staticmethod
    def calculate_returns(values: list[float]) -> list[float]:
        """
        Calculate period returns.
        """

        if len(values) < 2:
            return []

        return [
            (values[i] - values[i - 1]) / values[i - 1]
            for i in range(1, len(values))
            if values[i - 1] != 0
        ]

    @staticmethod
    def calculate_volatility(values: list[float]) -> float:
        """
        Annualized volatility.
        """

        returns = PortfolioRiskService.calculate_returns(values)

        if len(returns) < 2:
            return 0.0

        return stdev(returns) * sqrt(252)

    @staticmethod
    def calculate_max_drawdown(values: list[float]) -> float:
        """
        Maximum drawdown.
        """

        if not values:
            return 0.0

        peak = values[0]
        max_drawdown = 0.0

        for value in values:
            peak = max(peak, value)

            if peak != 0:
                drawdown = (value - peak) / peak
                max_drawdown = min(
                    max_drawdown,
                    drawdown
                )

        return max_drawdown

    @staticmethod
    def calculate_sharpe_ratio(
        values: list[float],
        risk_free_rate: float = 0.0
    ) -> float:
        """
        Annualized Sharpe ratio.
        """

        returns = PortfolioRiskService.calculate_returns(values)

        if len(returns) < 2:
            return 0.0

        excess_returns = [
            r - risk_free_rate / 252
            for r in returns
        ]

        deviation = stdev(excess_returns)

        if deviation == 0:
            return 0.0

        return (
            mean(excess_returns)
            / deviation
            * sqrt(252)
        )


# =====================================================
# Backward compatibility functions
# Keep old API working
# =====================================================


def calculate_returns(values: list[float]) -> list[float]:
    """
    Compatibility wrapper.
    """

    return PortfolioRiskService.calculate_returns(values)



def calculate_volatility(values: list[float]) -> float:
    """
    Compatibility wrapper for old API.
    """

    return PortfolioRiskService.calculate_volatility(values)



def calculate_max_drawdown(values: list[float]) -> float:
    """
    Compatibility wrapper for old API.
    """

    return PortfolioRiskService.calculate_max_drawdown(values)



def calculate_sharpe_ratio(
    values: list[float],
    risk_free_rate: float = 0.0
) -> float:
    """
    Compatibility wrapper for old API.
    """

    return PortfolioRiskService.calculate_sharpe_ratio(
        values,
        risk_free_rate
    )