def test_register_login_and_account_init(client):
    r = client.post('/api/auth/register', json={'username': 'alice', 'email': 'alice@example.com', 'password': 'Password123'})
    assert r.status_code == 200
    token = r.json()['access_token']
    me = client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + token})
    assert me.status_code == 200
    account = client.get('/api/account', headers={'Authorization': 'Bearer ' + token})
    assert account.status_code == 200
    assert account.json()['cash'] == '1000000.00'

    login = client.post('/api/auth/login', json={'username': 'alice', 'password': 'Password123'})
    assert login.status_code == 200
