import json
import logging
import sys

from app.core.logging import JsonFormatter


def test_json_logging_preserves_traceback():
    try:
        raise RuntimeError('AKShare upstream failed')
    except RuntimeError:
        record = logging.LogRecord('market', logging.ERROR, __file__, 1, 'AKShare error', (), sys.exc_info())
    payload = json.loads(JsonFormatter().format(record))
    assert payload['message'] == 'AKShare error'
    assert 'Traceback' in payload['exception']
    assert 'RuntimeError: AKShare upstream failed' in payload['exception']
