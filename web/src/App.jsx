import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import ThisWeek from './pages/ThisWeek.jsx'
import Search from './pages/Search.jsx'
import Diary from './pages/Diary.jsx'
import Settings from './pages/Settings.jsx'

const TABS = [
  { to: '/', label: '이번 주', icon: '💝' },
  { to: '/search', label: '찾기', icon: '🔍' },
  { to: '/diary', label: '다이어리', icon: '📔' },
  { to: '/settings', label: '설정', icon: '⚙️' },
]

export default function App() {
  return (
    <div className="app">
      <main className="content">
        <Routes>
          <Route path="/" element={<ThisWeek />} />
          <Route path="/search" element={<Search />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="tabbar">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end className="tab">
            <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
