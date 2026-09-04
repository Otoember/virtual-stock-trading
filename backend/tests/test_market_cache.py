from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import Mock

import pytest

from app.services.market_data.cache import CacheBusyError, MemoryTTLCache


def test_ttl_exactly_sixty_seconds_and_eviction():
    now = [0]
    cache = MemoryTTLCache(max_entries=2, clock=lambda: now[0])
    loader = Mock(side_effect=[1, 2, 3, 4, 5])
    try:
        assert cache.get_or_load('a', loader) == 1
        now[0] = 59.999
        assert cache.get_or_load('a', loader) == 1
        now[0] = 60
        assert cache.get_or_load('a', loader) == 2
        cache.get_or_load('b', loader)
        cache.get_or_load('c', loader)
        assert cache.get_or_load('a', loader) == 5
        assert loader.call_count == 5
    finally:
        cache.close()


def test_concurrent_requests_share_one_load_and_do_not_block_other_keys():
    cache = MemoryTTLCache()
    started, release = Event(), Event()

    def load():
        started.set()
        assert release.wait(2)
        return 42

    loader = Mock(side_effect=load)
    try:
        with ThreadPoolExecutor(8) as pool:
            futures = [pool.submit(cache.get_or_load, 'quote:000001', loader) for _ in range(8)]
            assert started.wait(1)
            assert cache.get_or_load('quote:600519', lambda: 12) == 12
            release.set()
            assert [f.result() for f in futures] == [42] * 8
        assert loader.call_count == 1
    finally:
        release.set()
        cache.close()


def test_timeout_keeps_one_inflight_job_and_bounds_queue():
    cache = MemoryTTLCache(max_pending=1)
    release = Event()
    loader = Mock(side_effect=lambda: (release.wait(2), 42)[1])
    try:
        with pytest.raises(TimeoutError):
            cache.get_or_load('a', loader, timeout=0.01)
        with pytest.raises(TimeoutError):
            cache.get_or_load('a', loader, timeout=0.01)
        with pytest.raises(CacheBusyError):
            cache.get_or_load('b', loader)
        release.set()
        assert cache.get_or_load('a', loader) == 42
        assert loader.call_count == 1
    finally:
        release.set()
        cache.close()


def test_failure_and_none_are_not_cached():
    cache = MemoryTTLCache()
    loader = Mock(side_effect=[RuntimeError('upstream'), None, 42])
    try:
        with pytest.raises(RuntimeError, match='upstream'):
            cache.get_or_load('a', loader)
        assert cache.get_or_load('a', loader) is None
        assert cache.get_or_load('a', loader) == 42
        assert loader.call_count == 3
    finally:
        cache.close()
