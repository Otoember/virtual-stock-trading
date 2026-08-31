import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { me } from './api'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MarketPage from './pages/MarketPage'
import StockPage from './pages/StockPage'
import PortfolioPage from './pages/PortfolioPage'
import OrdersPage from './pages/OrdersPage'
import LeaderboardPage from './pages/LeaderboardPage'

function App() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setReady(true)
      return
    }
    me().then(() => setAuthed(true)).catch(() => localStorage.removeItem('token')).finally(() => setReady(true))
  }, [])

  if (!ready) return <div className="content">Loading...</div>

  if (!authed) return <LoginPage onAuth={() => { setAuthed(true); nav('/') }} />

  return (
    <div className="layout">
      <aside className="sidebar">
        <h3>虚拟炒股</h3>
        <Link className="nav-item" to="/">Dashboard</Link>
        <Link className="nav-item" to="/market">行情</Link>
        <Link className="nav-item" to="/portfolio">持仓</Link>
        <Link className="nav-item" to="/orders">订单/成交</Link>
        <Link className="nav-item" to="/leaderboard">排行榜</Link>
        <button className="button secondary" onClick={() => { localStorage.removeItem('token'); setAuthed(false) }}>退出</button>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/stock/:symbol" element={<StockPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
