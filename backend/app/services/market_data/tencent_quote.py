"""Small, timeout-bounded single-stock fallback; no full-market downloads."""

from datetime import datetime
from decimal import Decimal
import re
from zoneinfo import ZoneInfo

import requests

from app.schemas.market import StockQuote


def market_symbol(symbol: str) -> str:
    if not re.fullmatch(r'(?:00\d{4}|30\d{4}|60\d{4}|68\d{4}|[48]\d{5}|92\d{4})', symbol):
        raise ValueError('Invalid A-share symbol')
    prefix = 'sh' if symbol.startswith('6') else 'sz' if symbol.startswith(('0', '3')) else 'bj'
    return prefix + symbol


def get_tencent_quote(symbol: str) -> StockQuote:
    ticker = market_symbol(symbol)
    response = requests.get('https://qt.gtimg.cn/q=' + ticker, timeout=(0.8, 1.2))
    response.raise_for_status()
    response.encoding = 'gbk'
    match = re.search(r'v_' + ticker + r'="([^"\r\n]+)";', response.text)
    if not match:
        raise ValueError('Tencent returned no quote for requested stock')
    fields = match.group(1).split('~')
    if len(fields) < 33 or fields[2] != symbol or not fields[1]:
        raise ValueError('Tencent returned an invalid quote or symbol mismatch')
    quote = StockQuote(
        symbol=symbol, name=fields[1], price=Decimal(fields[3]),
        change=Decimal(fields[31]), change_percent=Decimal(fields[32]),
        volume=int(Decimal(fields[6])),  # lots (手), same unit as AKShare Eastmoney
        updated_at=datetime.strptime(fields[30], '%Y%m%d%H%M%S').replace(tzinfo=ZoneInfo('Asia/Shanghai')),
        source='tencent',
    )
    if quote.price <= 0 or quote.volume < 0:
        raise ValueError('Tencent quote is suspended or unavailable')
    return quote
