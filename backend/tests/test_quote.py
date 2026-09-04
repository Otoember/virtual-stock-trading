from types import SimpleNamespace
from unittest.mock import Mock

import pandas as pd
import pytest

from app.main import app
from app.services.market_data.akshare_provider import AKShareMarketDataProvider
from app.services.market_data.cache import MemoryTTLCache
from app.services.market_data.factory import get_market_provider
from app.services.market_data.tencent_quote import get_tencent_quote, market_symbol


@pytest.fixture
def provider(monkeypatch):
    rows = {'代码': 'SZ000001', '名称': '平安银行', '现价': 11.89, '涨跌': 0.01,
            '涨幅': 0.08, '成交量': 81437300, '时间': '2026-09-04 16:15:00'}
    ak = SimpleNamespace(stock_individual_spot_xq=Mock(return_value=pd.DataFrame(rows.items(), columns=['item', 'value'])))
    monkeypatch.setattr(AKShareMarketDataProvider, '_import_akshare', staticmethod(lambda: ak))
    result = AKShareMarketDataProvider()
    yield result
    result.cache.close()


def test_quote_cache_ttl_and_timing(provider, caplog):
    now = [0]
    provider.cache.close()
    provider.cache = MemoryTTLCache(clock=lambda: now[0])
    first = provider.get_quote('000001')
    assert first.name == '平安银行'
    assert first.volume == 814373
    assert first.source == 'akshare-xueqiu'
    assert first.updated_at.utcoffset().total_seconds() == 28800
    now[0] = 59
    assert provider.get_quote('000001') is first
    provider._ak.stock_individual_spot_xq.assert_called_once_with(symbol='SZ000001', timeout=1.2)
    now[0] = 60
    provider.get_quote('000001')
    assert provider._ak.stock_individual_spot_xq.call_count == 2
    assert 'elapsed_ms=' in caplog.text
    assert 'Market cache hit key=quote:000001' in caplog.text


def test_quote_api_cache_and_failure_semantics(client, provider, monkeypatch):
    app.dependency_overrides[get_market_provider] = lambda: provider
    assert client.get('/api/market/quote/000001').status_code == 200
    assert client.get('/api/market/quote/000001').json()['source'] == 'akshare-xueqiu'
    assert provider._ak.stock_individual_spot_xq.call_count == 1
    provider.cache.invalidate('quote:000001')
    provider._ak.stock_individual_spot_xq.side_effect = RuntimeError('upstream')
    monkeypatch.setattr('app.services.market_data.akshare_provider.get_tencent_quote', Mock(side_effect=RuntimeError('fallback')))
    result = client.get('/api/market/quote/000001')
    assert result.status_code == 503
    assert result.json()['code'] == 'MARKET_DATA_UNAVAILABLE'
    provider.cache.get_or_load = Mock(side_effect=TimeoutError())
    assert client.get('/api/market/quote/000001').status_code == 504
    assert client.get('/api/market/quote/not-a-symbol').status_code == 404


@pytest.fixture
def tencent_response(monkeypatch):
    fields = [''] * 33
    for index, value in {0: '51', 1: '平安银行', 2: '000001', 3: '11.89', 6: '814373',
                         30: '20260904161500', 31: '0.01', 32: '0.08'}.items():
        fields[index] = value
    response = Mock(text='v_sz000001="' + '~'.join(fields) + '";')
    monkeypatch.setattr('app.services.market_data.tencent_quote.requests.get', Mock(return_value=response))
    return response


def test_tencent_fallback_cached_and_source_visible(provider, tencent_response):
    provider._ak.stock_individual_spot_xq.side_effect = RuntimeError('login required')
    first = provider.get_quote('000001')
    assert first.source == 'tencent'
    assert first.volume == 814373
    assert str(first.price) == '11.89'
    assert first.updated_at.year == 2026
    assert provider.get_quote('000001') is first
    assert provider._ak.stock_individual_spot_xq.call_count == 1


@pytest.mark.parametrize('payload', ['v_pv_none_match="1";', 'v_sz000001="51~bad~000001";',
                                     'v_sh000001="51~wrong-exchange";'])
def test_tencent_malformed_data_rejected(tencent_response, payload):
    tencent_response.text = payload
    with pytest.raises(ValueError):
        get_tencent_quote('000001')


@pytest.mark.parametrize('symbol,expected', [('000001', 'sz000001'), ('600519', 'sh600519'),
                                          ('300750', 'sz300750'), ('920001', 'bj920001')])
def test_exchange_mapping(symbol, expected):
    assert market_symbol(symbol) == expected


@pytest.mark.parametrize('symbol', ['../000001', '399001', '00001', '000001,sh600519'])
def test_invalid_or_index_symbols_rejected(symbol):
    with pytest.raises(ValueError):
        market_symbol(symbol)
