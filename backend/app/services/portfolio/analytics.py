from __future__ import annotations

from collections import defaultdict

from app.services.analytics.risk import (
    calculate_max_drawdown,
    calculate_sharpe_ratio,
    calculate_volatility,
)


class PortfolioAnalyticsService:
    """Portfolio-level analytics for investment dashboard."""

    def analyze_asset_curve(self, values: list[float]) -> dict:
        if not values:
            return {
                "return_rate": 0,
                "volatility": 0,
                "max_drawdown": 0,
                "sharpe_ratio": 0,
            }

        return {
            "return_rate": (values[-1] - values[0]) / values[0] if values[0] else 0,
            "volatility": calculate_volatility(values),
            "max_drawdown": calculate_max_drawdown(values),
            "sharpe_ratio": calculate_sharpe_ratio(values),
        }

    def industry_distribution(self, positions: list[dict]) -> dict:
        result = defaultdict(float)
        for position in positions:
            result[position.get("industry", "Unknown")] += position.get("market_value", 0)
        return dict(result)
