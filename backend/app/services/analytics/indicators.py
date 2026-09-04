from collections.abc import Sequence


def calculate_ma(prices: Sequence[float], period: int = 20) -> list[float | None]:
    """Calculate moving average."""
    result: list[float | None] = []
    for i in range(len(prices)):
        if i + 1 < period:
            result.append(None)
        else:
            window = prices[i + 1 - period:i + 1]
            result.append(sum(window) / period)
    return result


def calculate_rsi(prices: Sequence[float], period: int = 14) -> list[float | None]:
    """Basic RSI implementation for educational analysis."""
    if len(prices) <= period:
        return [None] * len(prices)

    result: list[float | None] = [None] * period
    gains = []
    losses = []

    for i in range(1, len(prices)):
        diff = prices[i] - prices[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))

    for i in range(period, len(prices)):
        avg_gain = sum(gains[i - period:i]) / period
        avg_loss = sum(losses[i - period:i]) / period
        if avg_loss == 0:
            result.append(100)
        else:
            rs = avg_gain / avg_loss
            result.append(100 - (100 / (1 + rs)))

    return result


def calculate_ema(prices: Sequence[float], period: int) -> list[float]:
    if not prices:
        return []

    alpha = 2 / (period + 1)
    values = [prices[0]]
    for price in prices[1:]:
        values.append(alpha * price + (1 - alpha) * values[-1])
    return values


def calculate_macd(prices: Sequence[float]) -> dict[str, list[float]]:
    ema12 = calculate_ema(prices, 12)
    ema26 = calculate_ema(prices, 26)
    dif = [a - b for a, b in zip(ema12, ema26)]
    dea = calculate_ema(dif, 9)
    macd = [(d - e) * 2 for d, e in zip(dif, dea)]
    return {
        "dif": dif,
        "dea": dea,
        "macd": macd,
    }
