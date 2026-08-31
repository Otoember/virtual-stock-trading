import { useState } from 'react'
import { login, register } from '../api'

export default function LoginPage({ onAuth }: { onAuth: () => void }) {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    try {
      const data = isRegister ? await register({ username, email, password }) : await login({ username, password })
      localStorage.setItem('token', data.access_token)
      onAuth()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '请求失败')
    }
  }

  return (
    <div className="content" style={{ maxWidth: 420, margin: '100px auto' }}>
      <div className="card">
        <h2>{isRegister ? '注册' : '登录'}</h2>
        <div className="row"><input className="input" placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        {isRegister && <div className="row"><input className="input" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} /></div>}
        <div className="row"><input className="input" placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="button" onClick={submit}>{isRegister ? '注册并进入' : '登录'}</button>
          <button className="button secondary" onClick={() => setIsRegister(!isRegister)}>{isRegister ? '切换到登录' : '切换到注册'}</button>
        </div>
      </div>
    </div>
  )
}
