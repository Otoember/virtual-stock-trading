import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Icon from './components/Icon'
import { me } from './api'
import LoginPage from './pages/LoginPage'
import MarketPage from './pages/MarketPage'
import PortfolioPage from './pages/PortfolioPage'
import OrdersPage from './pages/OrdersPage'
import LeaderboardPage from './pages/LeaderboardPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const StockPage = lazy(() => import('./pages/StockPage'))

function App() {
  const [ready, setReady] = useState(() => !localStorage.getItem('token'))
  const [authed, setAuthed] = useState(false)
  const nav = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    let active = true
    me()
      .then(() => {
        if (active) setAuthed(true)
      })
      .catch(() => {
        if (active) localStorage.removeItem('token')
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  if (!ready)
    return (
      <div className="session-loading" role="status">
        正在载入交易工作台…
      </div>
    )

  if (!authed)
    return (
      <LoginPage
        onAuth={() => {
          queryClient.clear()
          setAuthed(true)
          nav('/')
        }}
      />
    )

  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">
        跳至主要内容
      </a>
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="虚拟炒股首页">
          <span className="brand-mark">
            <Icon name="market" />
          </span>
          <span>
            虚拟炒股<small>TRADING WORKSPACE</small>
          </span>
        </NavLink>
        <div className="nav-label">投资工作台</div>
        <nav aria-label="主要导航">
          <NavLink className="nav-item" to="/" end>
            <Icon name="dashboard" />
            账户总览
          </NavLink>
          <NavLink className="nav-item" to="/market">
            <Icon name="market" />
            市场行情
          </NavLink>
          <NavLink className="nav-item" to="/portfolio">
            <Icon name="wallet" />
            我的持仓
          </NavLink>
          <NavLink className="nav-item" to="/orders">
            <Icon name="orders" />
            订单与成交
          </NavLink>
          <NavLink className="nav-item" to="/leaderboard">
            <Icon name="rank" />
            收益排行
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="simulation-card">
            <Icon name="shield" />
            <div>
              模拟交易账户<small>专注练习，不连接真实券商</small>
            </div>
          </div>
          <button
            className="logout-button"
            onClick={() => {
              localStorage.removeItem('token')
              queryClient.clear()
              setAuthed(false)
            }}
          >
            <Icon name="logout" />
            退出登录
          </button>
        </div>
      </aside>
      <main className="content" id="main-content" tabIndex={-1}>
        <Suspense
          fallback={
            <div className="session-loading" role="status">
              正在加载页面…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/stock/:symbol" element={<StockPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
