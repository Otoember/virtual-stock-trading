"""Bounded process-local TTL cache with one in-flight load per key."""

from collections import OrderedDict
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError
import logging
from threading import RLock
from time import monotonic

logger = logging.getLogger(__name__)


class CacheBusyError(RuntimeError):
    pass


class MemoryTTLCache:
    def __init__(self, ttl=60, max_entries=6000, max_pending=32, clock=monotonic):
        self.ttl = ttl
        self.max_entries = max_entries
        self.max_pending = max_pending
        self._clock = clock
        self._entries = OrderedDict()
        self._pending: dict[str, Future] = {}
        self._lock = RLock()
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix='market-cache')

    def get_or_load(self, key, loader, *, ttl=None, timeout=4.0):
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None and entry[0] > self._clock():
                self._entries.move_to_end(key)
                logger.info('Market cache hit key=%s', key)
                return entry[1]
            self._entries.pop(key, None)
            future = self._pending.get(key)
            if future is None:
                if len(self._pending) >= self.max_pending:
                    raise CacheBusyError('Market data loader capacity reached')
                logger.info('Market cache miss key=%s', key)
                future = self._executor.submit(loader)
                self._pending[key] = future
                future.add_done_callback(lambda done: self._finish(key, done, self.ttl if ttl is None else ttl))
            else:
                logger.info('Market cache coalesced key=%s', key)
        try:
            return future.result(timeout=timeout)
        except TimeoutError:
            # Keep the bounded in-flight task: later callers join it, not another load.
            logger.warning('Market cache wait timed out key=%s timeout=%.2fs', key, timeout)
            raise

    def _finish(self, key, future, ttl):
        with self._lock:
            try:
                value = future.result()
                if value is not None:
                    self._entries[key] = (self._clock() + ttl, value)
                    self._entries.move_to_end(key)
                    while len(self._entries) > self.max_entries:
                        self._entries.popitem(last=False)
            except Exception as exc:
                # Loader logs upstream errors. Never cache exceptions or failed results.
                logger.debug('Market cache rejected failed load key=%s error=%s', key, exc)
            finally:
                self._pending.pop(key, None)

    def invalidate(self, key):
        with self._lock:
            self._entries.pop(key, None)

    def close(self):
        self._executor.shutdown(wait=False, cancel_futures=True)
