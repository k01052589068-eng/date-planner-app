import { useState } from 'react'
import { logOut } from '../auth.jsx'
import { useCouple } from '../CoupleProvider.jsx'
import { leaveCouple } from '../couple.js'
import Avatar from '../components/Avatar.jsx'
import InviteCard from '../components/InviteCard.jsx'
import JoinForm from '../components/JoinForm.jsx'
import { getPendingInvite } from '../pendingInvite.js'

export default function Settings() {
  const { user } = useCouple()

  return (
    <section className="page">
      <h1>설정</h1>

      <h2 className="section-title">커플 연결</h2>
      <CoupleSection />

      <h2 className="section-title">데이트 취향</h2>
      <p className="placeholder">기준 위치, 이동 반경, 취향, 새로움 빈도, 추천 개수를 설정합니다. (2단계에서 구현)</p>

      <h2 className="section-title">계정</h2>
      <div className="card row">
        <Avatar name={user.displayName} photoURL={user.photoURL} />
        <div className="grow">
          <p className="strong">{user.displayName}</p>
          <p className="muted small">{user.email}</p>
        </div>
        <button type="button" className="btn btn-small" onClick={logOut}>
          로그아웃
        </button>
      </div>

      <p className="version">버전 {__APP_VERSION__}</p>
    </section>
  )
}

function CoupleSection() {
  const { user, couple, partner } = useCouple()
  const [showJoin, setShowJoin] = useState(() => !!getPendingInvite())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleLeave() {
    const ok = window.confirm(
      `${partner.name}님과 연결을 해제할까요?\n\n지금까지의 기록은 두 사람 모두에게 사본으로 남고, 나는 새 공간으로 옮겨져요. 다시 연결하려면 초대 코드가 필요해요.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await leaveCouple(user, couple)
    } catch (e) {
      console.error(e)
      setError('연결을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (partner) {
    return (
      <div className="card">
        <div className="row">
          <div className="avatar-pair">
            <Avatar name={user.displayName} photoURL={user.photoURL} />
            <Avatar name={partner.name} photoURL={partner.photoURL} />
          </div>
          <p className="grow">
            <strong>{partner.name}</strong>님과 함께 쓰고 있어요
          </p>
        </div>
        <button type="button" className="btn btn-danger btn-block" onClick={handleLeave} disabled={busy}>
          {busy ? '해제하는 중…' : '연결 해제'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <>
      <p className="muted small">아직 상대가 연결되지 않았어요.</p>
      <InviteCard />
      {showJoin ? (
        <div className="card">
          <p className="card-label">상대에게 받은 코드로 합류</p>
          <p className="muted small">합류하면 지금 공간의 기록은 상대 공간으로 옮겨져요.</p>
          <JoinForm currentCoupleId={couple.id} />
        </div>
      ) : (
        <button type="button" className="btn-link" onClick={() => setShowJoin(true)}>
          상대에게 받은 초대 코드가 있나요?
        </button>
      )}
    </>
  )
}
