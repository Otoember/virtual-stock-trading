"""Read-only live smoke benchmark; restart backend first to measure a cold cache."""

import argparse
import json
from time import perf_counter

import requests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:5173')
    parser.add_argument('--symbol', default='000001')
    args = parser.parse_args()
    session = requests.Session()
    session.trust_env = False  # Local benchmark must not go through the OS proxy.
    for run, limit in [('cold', 5), ('warm', 1)]:
        start = perf_counter()
        response = session.get(f'{args.base_url}/api/market/quote/{args.symbol}', timeout=10)
        elapsed = perf_counter() - start
        response.raise_for_status()
        quote = response.json()
        print(json.dumps({'run': run, 'seconds': round(elapsed, 4), 'http_status': response.status_code,
                          'symbol': quote['symbol'], 'name': quote['name'], 'price': quote['price'],
                          'source': quote['source'], 'updated_at': quote['updated_at']}, ensure_ascii=False), flush=True)
        assert quote['symbol'] == args.symbol and quote['source'] != 'mock', quote
        assert elapsed < limit, f'{run} load {elapsed:.3f}s exceeded {limit}s'


if __name__ == '__main__':
    main()
