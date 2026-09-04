
def register_and_token(client, username='bob'):
    r = client.post('/api/auth/register', json={
        'username': username,
        'email': f'{username}@example.com',
        'password': 'Password123'
    })
    return r.json()['access_token']


def test_buy_and_position(client):
    token = register_and_token(client)
    r = client.post('/api/orders', json={'symbol': '600519', 'side': 'BUY', 'quantity': 100}, headers={
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': 'k1'
    })
    assert r.status_code == 200
    p = client.get('/api/portfolio', headers={'Authorization': 'Bearer ' + token})
    assert p.status_code == 200
    assert p.json()[0]['total_quantity'] == 100


def test_insufficient_funds(client):
    token = register_and_token(client)
    r = client.post('/api/orders', json={'symbol': '600519', 'side': 'BUY', 'quantity': 10000000}, headers={
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': 'k2'
    })
    assert r.status_code == 400
    assert r.json()['code'] == 'INSUFFICIENT_FUNDS'


def test_invalid_quantity(client):
    token = register_and_token(client)
    r = client.post('/api/orders', json={'symbol': '600519', 'side': 'BUY', 'quantity': 50}, headers={
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': 'k3'
    })
    assert r.status_code == 400
    assert r.json()['code'] == 'INVALID_QUANTITY'


def test_t1_restriction(client):
    token = register_and_token(client)
    client.post('/api/orders', json={'symbol': '600519', 'side': 'BUY', 'quantity': 100}, headers={
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': 'k4'
    })
    sell = client.post('/api/orders', json={'symbol': '600519', 'side': 'SELL', 'quantity': 100}, headers={
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': 'k5'
    })
    assert sell.status_code == 400
    assert sell.json()['code'] == 'T1_RESTRICTION'


def test_duplicate_order(client):
    token = register_and_token(client)
    headers = {'Authorization': 'Bearer ' + token, 'Idempotency-Key': 'same'}
    one = client.post('/api/orders', json={'symbol': '600519', 'side': 'BUY', 'quantity': 100}, headers=headers)
    two = client.post('/api/orders', json={'symbol': '600519', 'side': 'BUY', 'quantity': 100}, headers=headers)
    assert one.status_code == 200
    assert two.status_code == 409
    assert two.json()['code'] == 'ORDER_DUPLICATED'


def test_limit_buy_pending_and_cancel(client):
    token = register_and_token(client, username='limit_buy')
    place = client.post('/api/orders', json={
        'symbol': '600519',
        'side': 'BUY',
        'order_type': 'LIMIT',
        'quantity': 100,
        'limit_price': '0.10',
    }, headers={
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': 'lb1'
    })
    assert place.status_code == 200
    order = place.json()
    assert order['status'] == 'PENDING'
    assert order['remaining_quantity'] == 100
    assert float(order['reserved_cash']) > 0

    before_cancel = client.get('/api/account', headers={'Authorization': 'Bearer ' + token}).json()
    assert float(before_cancel['frozen_cash']) > 0

    cancel = client.post(f"/api/orders/{order['id']}/cancel", headers={'Authorization': 'Bearer ' + token})
    assert cancel.status_code == 200
    assert cancel.json()['status'] == 'CANCELLED'

    after_cancel = client.get('/api/account', headers={'Authorization': 'Bearer ' + token}).json()
    assert float(after_cancel['frozen_cash']) == 0


def test_limit_match_endpoint_keeps_unmatched_order(client):
    token = register_and_token(client, username='limit_match')
    place = client.post('/api/orders', json={
        'symbol': '600519',
        'side': 'BUY',
        'order_type': 'LIMIT',
        'quantity': 100,
        'limit_price': '0.10',
    }, headers={
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': 'lb2'
    })
    assert place.status_code == 200
    order_id = place.json()['id']

    match = client.post('/api/orders/match', headers={'Authorization': 'Bearer ' + token})
    assert match.status_code == 200

    orders = client.get('/api/orders', headers={'Authorization': 'Bearer ' + token}).json()
    target = next(x for x in orders if x['id'] == order_id)
    assert target['status'] == 'PENDING'


def test_limit_buy_immediate_fill(client):
    token = register_and_token(client, username='limit_fill')
    place = client.post('/api/orders', json={
        'symbol': '600519',
        'side': 'BUY',
        'order_type': 'LIMIT',
        'quantity': 100,
        'limit_price': '1000.00',
    }, headers={
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': 'lb4'
    })
    assert place.status_code == 200
    body = place.json()
    assert body['status'] == 'FILLED'
    assert body['filled_quantity'] == 100
