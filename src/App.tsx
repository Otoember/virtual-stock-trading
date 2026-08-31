import { NavLink, Route, Routes } from 'react-router-dom';
import AboutPage from './pages/About';
import HistoryPage from './pages/History';
import ReadingPage from './pages/Reading';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand__title">塔罗牌解读</div>
          <div className="brand__sub">离线基础解读 + DeepSeek 增强</div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav__item nav__item--active' : 'nav__item')}>
            占卜
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => (isActive ? 'nav__item nav__item--active' : 'nav__item')}>
            日志
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => (isActive ? 'nav__item nav__item--active' : 'nav__item')}>
            关于
          </NavLink>
        </nav>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<ReadingPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <div>免责声明：本应用仅供自我反思与沟通辅助，不替代医疗/法律/投资等专业意见。</div>
      </footer>
    </div>
  );
}

