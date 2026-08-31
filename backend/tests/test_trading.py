
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
