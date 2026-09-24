import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { CoupleProvider, useCouple } from './CoupleProvider.jsx'
import Login from './pages/Login.jsx'
import Onboarding from './pages/Onboarding.jsx'
import ThisWeek from './pages/ThisWeek.jsx'
import Search from './pages/Search.jsx'
import Diary from './pages/Diary.jsx'
import DiaryDetail from './pages/DiaryDetail.jsx'
import DiaryEdit from './pages/DiaryEdit.jsx'
import Settings from './pages/Settings.jsx'

const TABS = [
  { to: '/', label: '이번 주', icon: '💝' },
  { to: '/search', label: '찾기', icon: '🔍' },
  { to: '/diary', label: '다이어리', icon: '📔' },
  { to: '/settings', label: '설정', icon: '⚙️' },
]

export default function App() {
  const { user } = useAuth()
  if (user === undefined) return <Splash />
  if (!user) return <Login />
  return (
    <CoupleProvider user={user}>
      <CoupleGate />
    </CoupleProvider>
  )
}

function CoupleGate() {
  const { couple } = useCouple()
  if (couple === undefined) return <Splash />
  if (!couple) return <Onboarding />
  return <MainTabs />
}

function MainTabs() {
  const { partner } = useCouple()

  return (
    <div className="app">
      <main className="content">
        <Routes>
          <Route path="/" element={<ThisWeek />} />
          <Route path="/search" element={<Search />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/diary/new" element={<DiaryEdit />} />
          <Route path="/diary/:id" element={<DiaryDetail />} />
          <Route path="/diary/:id/edit" element={<DiaryEdit />} />
          <Route path="/settings" element={<Settings />} />
          {/* 초대 링크: 혼자 쓰는 중이면 설정의 합류 폼으로 */}
          <Route path="/join" element={<Navigate to={partner ? '/' : '/settings'} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="tabbar">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="tab">
            <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Splash() {
  return (
    <div className="centered-screen">
      <span className="brand-icon splash" aria-label="불러오는 중">💝</span>
    </div>
  )
}
