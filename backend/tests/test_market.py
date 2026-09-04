from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import pandas as pd
import pytest

from app.core.config import Settings, get_settings
from app.core.exceptions import AppError
from app.main import app
from app.services.market_data import factory
from app.services.market_data.akshare_provider import AKShareMarketDataProvider
from app.services.market_data.mock_provider import MockMarketDataProvider


@pytest.fixture
def ak_provider(monkeypatch):
    # Generated fixtures only; production always loads the live AKShare universe.
    rows = [{'code': str(600000 + i), 'name': f'测试股票{i}'} for i in range(70)]
    rows += [
        {'code': '300750', 'name': '宁德时代'},
        {'code': '600519', 'name': '贵州茅台'},
        {'code': '000001', 'name': '平安银行'},
        {'code': '600036', 'name': '招商银行'},
        {'code': '000002', 'name': '*ST测试'},
    ]
    ak = SimpleNamespace(stock_info_a_code_name=Mock(return_value=pd.DataFrame(rows)))
    monkeypatch.setattr(AKShareMarketDataProvider, '_import_akshare', staticmethod(lambda: ak))
    provider = AKShareMarketDataProvider()
    yield provider
    provider.cache.close()


@pytest.fixture(autouse=True)
def clear_provider_cache():
    factory.get_market_provider.cache_clear()
    get_settings.cache_clear()
    yield
    factory.get_market_provider.cache_clear()
    get_settings.cache_clear()


def test_default_provider(ak_provider, monkeypatch):
    monkeypatch.delenv('MARKET_PROVIDER', raising=False)
    assert Settings(_env_file=None).MARKET_PROVIDER == 'akshare'
    assert isinstance(factory.get_market_provider(), AKShareMarketDataProvider)
    assert factory.get_market_provider() is factory.get_market_provider()


def test_explicit_mock(monkeypatch):
    monkeypatch.setenv('MARKET_PROVIDER', ' MOCK ')
    assert isinstance(factory.get_market_provider(), MockMarketDataProvider)


def test_import_failure_fallback(monkeypatch, caplog):
    monkeypatch.setenv('MARKET_PROVIDER', 'akshare')
    monkeypatch.setattr(factory, 'AKShareMarketDataProvider', Mock(side_effect=ImportError('missing akshare')))
    assert isinstance(factory.get_market_provider(), MockMarketDataProvider)
    assert 'missing akshare' in caplog.text
    assert 'falling back to mock' in caplog.text


@pytest.mark.parametrize('keyword,symbol', [('宁德', '300750'), ('茅台', '600519'), ('000', '000001'), ('300', '300750'), ('银行', '000001')])
def test_search_keywords(ak_provider, keyword, symbol):
    assert symbol in [item.symbol for item in ak_provider.search_stock(keyword)]


def test_limit_literal_blank_and_cache(ak_provider):
    assert ak_provider.search_stock('  ') == []
    ak_provider._ak.stock_info_a_code_name.assert_not_called()
    assert len(ak_provider.search_stock('600')) == 50
    assert ak_provider.search_stock('[') == []
    assert ak_provider.search_stock('.*') == []
    assert ak_provider.search_stock('*ST')[0].symbol == '000002'
    assert ak_provider.search_stock(' 宁德 ')[0].symbol == '300750'
    ak_provider._ak.stock_info_a_code_name.assert_called_once()
    assert ak_provider.get_stock_info('300') is None


def test_normalize_and_refresh(ak_provider):
    ak_provider._ak.stock_info_a_code_name.return_value = pd.DataFrame([
        {'code': 1, 'name': '平安银行'}, {'code': 1, 'name': '重复'},
        {'code': None, 'name': None}, {'code': 'bad', 'name': '无效'},
    ])
    assert [s.symbol for s in ak_provider.search_stock('000')] == ['000001']
    ak_provider.cache.invalidate('stock_pool')
    ak_provider.search_stock('000')
    assert ak_provider._ak.stock_info_a_code_name.call_count == 2


def test_search_api_and_status(client, ak_provider):
    app.dependency_overrides[factory.get_market_provider] = lambda: ak_provider
    response = client.get('/api/market/search', params={'keyword': '宁德'})
    assert response.status_code == 200
    assert response.json() == [{'symbol': '300750', 'name': '宁德时代'}]
    assert len(client.get('/api/market/search', params={'keyword': '600'}).json()) == 50
    assert client.get('/api/market/search', params={'keyword': ''}).json() == []
    assert client.get('/api/market/provider').json() == {'provider': 'akshare', 'available': True}


def test_upstream_failure_visible_and_recoverable(client, ak_provider, caplog):
    app.dependency_overrides[factory.get_market_provider] = lambda: ak_provider
    ak_provider._ak.stock_info_a_code_name.side_effect = RuntimeError('upstream unreachable')
    response = client.get('/api/market/search', params={'keyword': '宁德'})
    assert response.status_code == 503
    assert response.json()['code'] == 'MARKET_DATA_UNAVAILABLE'
    assert client.get('/api/market/provider').json() == {'provider': 'akshare', 'available': False}
    assert 'upstream unreachable' in caplog.text
    ak_provider._ak.stock_info_a_code_name.side_effect = None
    assert client.get('/api/market/search', params={'keyword': '宁德'}).status_code == 200


def test_invalid_pool_unavailable(ak_provider, caplog):
    ak_provider._ak.stock_info_a_code_name.return_value = pd.DataFrame()
    assert not ak_provider.is_available()
    assert 'empty A-share stock pool' in caplog.text


def test_chinese_column_compatibility(ak_provider):
    ak_provider._ak.stock_info_a_code_name.return_value = pd.DataFrame([
        {'代码': '300750', '名称': '宁德时代'},
    ])
    assert ak_provider.search_stock('宁德')[0].symbol == '300750'


def test_quote_history_errors_logged(ak_provider, caplog, monkeypatch):
    ak_provider._ak.stock_individual_spot_xq = Mock(side_effect=RuntimeError('quote failure'))
    monkeypatch.setattr('app.services.market_data.akshare_provider.get_tencent_quote', Mock(side_effect=RuntimeError('fallback failure')))
    ak_provider._ak.stock_zh_a_hist = Mock(side_effect=RuntimeError('history failure'))
    with pytest.raises(AppError, match='行情数据源暂时不可用'):
        ak_provider.get_quote('600519')
    assert ak_provider.get_history('600519', date.today(), date.today()) == []
    assert 'quote failure' in caplog.text
    assert 'history failure' in caplog.text


def test_mock_status(client):
    assert client.get('/api/market/provider').json() == {'provider': 'mock', 'available': True}
