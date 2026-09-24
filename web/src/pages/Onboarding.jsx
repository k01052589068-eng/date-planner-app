import { useState } from 'react'
import { logOut } from '../auth.jsx'
import { useCouple } from '../CoupleProvider.jsx'
import { createCouple } from '../couple.js'
import JoinForm from '../components/JoinForm.jsx'

/** 로그인했지만 아직 커플 공간이 없는 사용자 */
export default function Onboarding() {
  const { user } = useCouple()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      await createCouple(user)
    } catch (e) {
      console.error(e)
      setError('공간을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  return (
    <div className="centered-screen">
      <div className="brand">
        <span className="brand-icon" aria-hidden="true">💑</span>
        <h1>{user.displayName ? `${user.displayName}님, 반가워요` : '반가워요'}</h1>
        <p className="muted">둘이 함께 쓸 공간을 만들거나, 상대가 보낸 초대 코드로 합류하세요.</p>
      </div>

      <div className="card">
        <p className="card-label">초대 코드가 있어요</p>
        <JoinForm />
      </div>

      <div className="card">
        <p className="card-label">처음 시작해요</p>
        <p className="muted small">새 커플 공간을 만든 뒤 초대 코드를 상대에게 보내면 돼요.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={handleCreate} disabled={busy}>
          {busy ? '만드는 중…' : '새 커플 공간 만들기'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      <button type="button" className="btn-link" onClick={logOut}>
        다른 계정으로 로그인
      </button>
    </div>
  )
}
